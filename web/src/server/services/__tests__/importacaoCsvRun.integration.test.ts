import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/server/db";
import { runImportacaoCsv } from "../importacaoCsvService";
import { isIntegrationEnabled } from "@/test/integration/integrationEnv";
import { resetIntegrationDatabase } from "@/test/integration/dbReset";
import {
  INTEGRATION_ACTOR_USER_ID,
  seedIntegrationMinimal,
} from "@/test/integration/seedMinimal";
import {
  assertEntidadeImportAudit,
  assertImportacaoLoteAuditTrail,
} from "@/test/integration/assertImportacaoAuditoria";
import { seedB2DualSemCnpjCandidates } from "@/test/integration/seedB2";
import { seedReconciliationCandidates } from "@/test/integration/seedReconciliation";
import {
  csvAtoEventoDocumentoReimportacao,
  csvAtoEventoDocumentoValidos,
  csvB2SemCnpjMesmaChave,
  csvDocumentoTipoNaoCadastrado,
  csvMultiLinhaNovoCnpjEReconciliacao,
  csvMultiLinhaTresComportamentos,
  csvMultiLinhaValidaERejeicaoUnknownTipo,
  csvNovoCnpjComProcesso,
  csvReconciliacaoManualComFilhos,
  csvReconciliacaoManualSemCnpj,
  csvReimportacaoUpdate,
  reconciliacoesLinha2,
  reconciliacoesPorLinhas,
  INTEGRATION_CNPJ_A,
  INTEGRATION_CNPJ_B2,
  INTEGRATION_CNPJ_C,
  INTEGRATION_CNPJ_D,
  INTEGRATION_CNPJ_MULTI,
  INTEGRATION_CNPJ_MULTI_OK,
  INTEGRATION_CNPJ_TRIPLE_OK,
} from "@/test/integration/csvFixtures";

const runInput = (
  csvText: string,
  arquivoNome: string,
  reconciliacoes?: Record<number, string>,
) => ({
  csvText,
  actorUserId: INTEGRATION_ACTOR_USER_ID,
  arquivoNome,
  reconciliacoes,
});

describe.skipIf(!isIntegrationEnabled())(
  "runImportacaoCsv — smoke de integração (PostgreSQL)",
  () => {
    beforeEach(async () => {
      await resetIntegrationDatabase();
      await seedIntegrationMinimal();
    });

    test("cenário A: CNPJ novo cria instituição e processo", async () => {
      const result = await runImportacaoCsv(
        runInput(csvNovoCnpjComProcesso(), "smoke-a.csv"),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      const inst = await prisma.instituicao.findUnique({
        where: { cnpj: INTEGRATION_CNPJ_A },
      });
      expect(inst).toMatchObject({
        nome: "Escola Integração Smoke",
        municipio: "Florianópolis",
        uf: "SC",
        deletedAt: null,
      });

      const processos = await prisma.processo.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
      });
      expect(processos).toHaveLength(1);
      expect(processos[0]).toMatchObject({
        numero: "PROC-SMOKE-001",
        ano: 2024,
        assunto: "Assunto inicial",
      });

      const lote = await prisma.importacaoLote.findUnique({
        where: { id: result.loteId },
      });
      expect(lote?.status).toBe("IMPORTADO");
      expect(lote?.contagemImportadas).toBe(1);
    });

    test("cenário B: reimportação atualiza instituição e processo (idempotência de chave)", async () => {
      await runImportacaoCsv(
        runInput(csvNovoCnpjComProcesso(), "smoke-b-1.csv"),
      );

      const result2 = await runImportacaoCsv(
        runInput(csvReimportacaoUpdate(), "smoke-b-2.csv"),
      );

      expect(result2).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      const instCount = await prisma.instituicao.count({
        where: { cnpj: INTEGRATION_CNPJ_A, deletedAt: null },
      });
      expect(instCount).toBe(1);

      const inst = await prisma.instituicao.findUnique({
        where: { cnpj: INTEGRATION_CNPJ_A },
      });
      expect(inst?.nome).toBe("Escola Integração Smoke Atualizada");
      expect(inst?.municipio).toBe("São José");

      const processos = await prisma.processo.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
      });
      expect(processos).toHaveLength(1);
      expect(processos[0]).toMatchObject({
        numero: "PROC-SMOKE-001",
        ano: 2024,
        assunto: "Assunto revisado",
        status: "EM_TRAMITACAO",
      });
    });

    test("cenário B2: dois candidatos na mesma chave — run atualiza o que tem CNPJ", async () => {
      const { semCnpjId, comCnpjId } = await seedB2DualSemCnpjCandidates();

      const result = await runImportacaoCsv(
        runInput(csvB2SemCnpjMesmaChave(), "smoke-b2.csv"),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(2);

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
      });

      const semCnpjAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: semCnpjId },
      });
      expect(semCnpjAfter).toMatchObject({
        nome: "Escola Alfa Primeira Sem Cnpj",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: null,
      });
      expect(semCnpjAfter.importacaoLoteId).toBeNull();

      const comCnpjAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: comCnpjId },
      });
      expect(comCnpjAfter.id).toBe(comCnpjId);
      expect(comCnpjAfter).toMatchObject({
        nome: "Escola Alfa Atualizada B2",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: INTEGRATION_CNPJ_B2,
      });
      expect(comCnpjAfter.nomeNormalizado).toBe("ESCOLA ALFA");
      expect(comCnpjAfter.importacaoLoteId).toBe(lote.id);
    });

    test("cenário D: ato, evento e documento válidos persistem com vínculo à instituição e ao lote", async () => {
      const result = await runImportacaoCsv(
        runInput(csvAtoEventoDocumentoValidos(), "smoke-d.csv"),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      const inst = await prisma.instituicao.findUnique({
        where: { cnpj: INTEGRATION_CNPJ_D },
      });
      expect(inst).toMatchObject({
        nome: "Escola Filhos Regulatórios",
        municipio: "Florianópolis",
        uf: "SC",
        deletedAt: null,
      });

      const lote = await prisma.importacaoLote.findUnique({
        where: { id: result.loteId },
      });
      expect(lote?.status).toBe("IMPORTADO");
      expect(lote?.fonteDadosId).toBeTruthy();

      const impacto = lote?.relatorioImpacto as {
        instituicoes?: { created: number; updated: number };
        atos?: { created: number; updated: number };
        eventos?: { created: number; updated: number };
        documentos?: { created: number; updated: number };
      } | null;
      expect(impacto).toMatchObject({
        instituicoes: { created: 1, updated: 0 },
        atos: { created: 1, updated: 0 },
        eventos: { created: 1, updated: 0 },
        documentos: { created: 1, updated: 0 },
      });

      const atos = await prisma.atoAutorizativo.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
      });
      expect(atos).toHaveLength(1);
      expect(atos[0]).toMatchObject({
        tipo: "PARECER",
        numero: "PRC-2024-01",
        ementa: "Ementa do parecer smoke",
        instituicaoId: inst!.id,
        importacaoLoteId: lote!.id,
        fonteDadosId: lote!.fonteDadosId,
        sourceRef: "row:2",
      });
      expect(atos[0].dataAto.toISOString().slice(0, 10)).toBe("2024-03-15");

      const eventos = await prisma.eventoRegulatorio.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
      });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        tipo: "PROTOCOLO",
        descricao: "Protocolo de integração",
        instituicaoId: inst!.id,
        importacaoLoteId: lote!.id,
        fonteDadosId: lote!.fonteDadosId,
        sourceRef: "row:2",
      });
      expect(eventos[0].dataEvento.toISOString().slice(0, 10)).toBe("2024-03-16");

      const docs = await prisma.documento.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
        include: { tipoDocumento: true },
      });
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({
        titulo: "Ofício smoke integração",
        instituicaoId: inst!.id,
        importacaoLoteId: lote!.id,
        fonteDadosId: lote!.fonteDadosId,
        sourceRef: "row:2",
        tipoDocumento: { codigo: "OFICIO" },
      });
      expect(docs[0].dataDocumento?.toISOString().slice(0, 10)).toBe("2024-03-17");

      expect(inst!.importacaoLoteId).toBe(lote!.id);
      expect(inst!.fonteDadosId).toBe(lote!.fonteDadosId);
    });

    test("cenário D′: reimportação da linha rica atualiza instituição, ato, evento e documento sem duplicar", async () => {
      await runImportacaoCsv(
        runInput(csvAtoEventoDocumentoValidos(), "smoke-d-prime.csv"),
      );

      const instBefore = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_D },
      });
      const atoBefore = await prisma.atoAutorizativo.findFirstOrThrow({
        where: { instituicaoId: instBefore.id, deletedAt: null },
      });
      const eventoBefore = await prisma.eventoRegulatorio.findFirstOrThrow({
        where: { instituicaoId: instBefore.id, deletedAt: null },
      });
      const docBefore = await prisma.documento.findFirstOrThrow({
        where: { instituicaoId: instBefore.id, deletedAt: null },
      });

      const result2 = await runImportacaoCsv(
        runInput(csvAtoEventoDocumentoReimportacao(), "smoke-d-prime-2.csv"),
      );

      expect(result2).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      const lote2 = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result2.loteId },
      });
      expect(lote2.status).toBe("IMPORTADO");
      expect(lote2.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
        atos: { created: 0, updated: 1 },
        eventos: { created: 0, updated: 1 },
        documentos: { created: 0, updated: 1 },
      });

      expect(
        await prisma.instituicao.count({
          where: { cnpj: INTEGRATION_CNPJ_D, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.atoAutorizativo.count({
          where: { instituicaoId: instBefore.id, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.eventoRegulatorio.count({
          where: { instituicaoId: instBefore.id, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.documento.count({
          where: { instituicaoId: instBefore.id, deletedAt: null },
        }),
      ).toBe(1);

      const instAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: instBefore.id },
      });
      expect(instAfter.id).toBe(instBefore.id);
      expect(instAfter).toMatchObject({
        nome: "Escola Filhos Regulatórios Revisada",
        municipio: "São José",
        uf: "SC",
      });

      const atoAfter = await prisma.atoAutorizativo.findUniqueOrThrow({
        where: { id: atoBefore.id },
      });
      expect(atoAfter).toMatchObject({
        tipo: "PARECER",
        numero: "PRC-2024-01",
        ementa: "Ementa revisada na reimportação",
        descricao: "Descrição revisada do parecer",
        instituicaoId: instBefore.id,
      });
      expect(atoAfter.dataAto.toISOString().slice(0, 10)).toBe("2024-03-15");

      const eventoAfter = await prisma.eventoRegulatorio.findUniqueOrThrow({
        where: { id: eventoBefore.id },
      });
      expect(eventoAfter.id).toBe(eventoBefore.id);
      expect(eventoAfter).toMatchObject({
        tipo: "PROTOCOLO",
        descricao: "Protocolo de integração",
        instituicaoId: instBefore.id,
      });
      expect(eventoAfter.dataEvento.toISOString().slice(0, 10)).toBe("2024-03-16");

      const docAfter = await prisma.documento.findUniqueOrThrow({
        where: { id: docBefore.id },
        include: { tipoDocumento: true },
      });
      expect(docAfter.id).toBe(docBefore.id);
      expect(docAfter).toMatchObject({
        titulo: "Ofício smoke integração",
        instituicaoId: instBefore.id,
        tipoDocumento: { codigo: "OFICIO" },
      });
      expect(docAfter.dataDocumento?.toISOString().slice(0, 10)).toBe("2024-03-17");
    });

    test("cenário E: reconciliação manual sem CNPJ atualiza a instituição canônica do mapa", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(
          csvReconciliacaoManualSemCnpj(),
          "smoke-e.csv",
          reconciliacoesLinha2(canonicalId),
        ),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(2);

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
      });
      expect(lote.reconciliacoes).toEqual({ 2: canonicalId });

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter).toMatchObject({
        nome: "Escola Alfa Candidata",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: null,
      });

      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter.id).toBe(canonicalId);
      expect(canonicalAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: null,
      });
      expect(canonicalAfter.nomeNormalizado).toBe("ESCOLA ALFA");
      expect(canonicalAfter.importacaoLoteId).toBe(lote.id);

      await assertImportacaoLoteAuditTrail(result.loteId, INTEGRATION_ACTOR_USER_ID, {
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });
      await assertEntidadeImportAudit(
        "instituicoes",
        canonicalId,
        result.loteId,
        {
          acao: "UPDATE",
          rowNumber: 2,
          actorUserId: INTEGRATION_ACTOR_USER_ID,
          reconciliadoPara: canonicalId,
        },
      );
    });

    test("cenário E + filhos: reconciliação manual vincula processo e ato à instituição canônica", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(
          csvReconciliacaoManualComFilhos(),
          "smoke-e-filhos.csv",
          reconciliacoesLinha2(canonicalId),
        ),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(2);

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
        processos: { created: 1, updated: 0 },
        atos: { created: 1, updated: 0 },
      });

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter).toMatchObject({
        nome: "Escola Alfa Candidata",
        municipio: "Florianópolis",
        uf: "SC",
      });

      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        uf: "SC",
      });

      expect(
        await prisma.processo.count({
          where: { instituicaoId: autoMatchId, deletedAt: null },
        }),
      ).toBe(0);
      expect(
        await prisma.atoAutorizativo.count({
          where: { instituicaoId: autoMatchId, deletedAt: null },
        }),
      ).toBe(0);

      const processos = await prisma.processo.findMany({
        where: { instituicaoId: canonicalId, deletedAt: null },
      });
      expect(processos).toHaveLength(1);
      expect(processos[0]).toMatchObject({
        instituicaoId: canonicalId,
        numero: "PROC-RECON-001",
        ano: 2024,
        assunto: "Processo pós-reconciliação",
        importacaoLoteId: lote.id,
        fonteDadosId: lote.fonteDadosId,
        sourceRef: "row:2",
      });

      const atos = await prisma.atoAutorizativo.findMany({
        where: { instituicaoId: canonicalId, deletedAt: null },
      });
      expect(atos).toHaveLength(1);
      expect(atos[0]).toMatchObject({
        instituicaoId: canonicalId,
        tipo: "PARECER",
        numero: "ATOR-RECON-01",
        ementa: "Ementa ato reconciliado",
        importacaoLoteId: lote.id,
        fonteDadosId: lote.fonteDadosId,
        sourceRef: "row:2",
      });
      expect(atos[0].dataAto.toISOString().slice(0, 10)).toBe("2024-04-01");
    });

    test("cenário E + filhos controle: sem reconciliacoes vincula processo e ato à candidata auto-match", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(csvReconciliacaoManualComFilhos(), "smoke-e-filhos-controle.csv"),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(2);

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
        processos: { created: 1, updated: 0 },
        atos: { created: 1, updated: 0 },
      });
      expect(lote.reconciliacoes).toBeNull();

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter.id).toBe(autoMatchId);
      expect(autoAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: null,
      });
      expect(autoAfter.nomeNormalizado).toBe("ESCOLA ALFA");
      expect(autoAfter.importacaoLoteId).toBe(lote.id);

      const processosAuto = await prisma.processo.findMany({
        where: { instituicaoId: autoMatchId, deletedAt: null },
      });
      expect(processosAuto).toHaveLength(1);
      expect(processosAuto[0]).toMatchObject({
        instituicaoId: autoMatchId,
        numero: "PROC-RECON-001",
        ano: 2024,
        assunto: "Processo pós-reconciliação",
        importacaoLoteId: lote.id,
        fonteDadosId: lote.fonteDadosId,
        sourceRef: "row:2",
      });

      const atosAuto = await prisma.atoAutorizativo.findMany({
        where: { instituicaoId: autoMatchId, deletedAt: null },
      });
      expect(atosAuto).toHaveLength(1);
      expect(atosAuto[0]).toMatchObject({
        instituicaoId: autoMatchId,
        tipo: "PARECER",
        numero: "ATOR-RECON-01",
        ementa: "Ementa ato reconciliado",
        importacaoLoteId: lote.id,
        fonteDadosId: lote.fonteDadosId,
        sourceRef: "row:2",
      });

      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter).toMatchObject({
        nome: "Instituição Canônica Reconciliação",
        municipio: "São José",
        uf: "SC",
        cnpj: null,
      });
      expect(canonicalAfter.importacaoLoteId).toBeNull();

      expect(
        await prisma.processo.count({
          where: { instituicaoId: canonicalId, deletedAt: null },
        }),
      ).toBe(0);
      expect(
        await prisma.atoAutorizativo.count({
          where: { instituicaoId: canonicalId, deletedAt: null },
        }),
      ).toBe(0);
    });

    test("cenário E controle: sem reconciliacoes atualiza a candidata auto-match e preserva a canônica", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(csvReconciliacaoManualSemCnpj(), "smoke-e-controle.csv"),
      );

      expect(result).toMatchObject({
        imported: 1,
        rejected: 0,
        errorsCount: 0,
      });

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(2);

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 0, updated: 1 },
      });
      expect(lote.reconciliacoes).toBeNull();

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter.id).toBe(autoMatchId);
      expect(autoAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        uf: "SC",
        cnpj: null,
      });
      expect(autoAfter.nomeNormalizado).toBe("ESCOLA ALFA");
      expect(autoAfter.importacaoLoteId).toBe(lote.id);

      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter.id).toBe(canonicalId);
      expect(canonicalAfter).toMatchObject({
        nome: "Instituição Canônica Reconciliação",
        municipio: "São José",
        uf: "SC",
        cnpj: null,
      });
      expect(canonicalAfter.importacaoLoteId).toBeNull();
    });

    test("cenário multi-linha: isolamento entre linhas, contagens do lote e reconciliacoes por rowNumber", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(
          csvMultiLinhaNovoCnpjEReconciliacao(),
          "smoke-multi.csv",
          reconciliacoesPorLinhas({ 3: canonicalId }),
        ),
      );

      expect(result).toMatchObject({
        imported: 2,
        rejected: 0,
        errorsCount: 0,
      });

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote).toMatchObject({
        status: "IMPORTADO",
        contagemLidas: 2,
        contagemImportadas: 2,
        contagemRejeitadas: 0,
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 1, updated: 1 },
        processos: { created: 1, updated: 0 },
      });
      expect(lote.reconciliacoes).toEqual({ 3: canonicalId });

      const instMulti = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_MULTI },
      });
      expect(instMulti).toMatchObject({
        nome: "Escola Multi Linha A",
        municipio: "Florianópolis",
        uf: "SC",
        importacaoLoteId: lote.id,
      });

      const processosMulti = await prisma.processo.findMany({
        where: { instituicaoId: instMulti.id, deletedAt: null },
      });
      expect(processosMulti).toHaveLength(1);
      expect(processosMulti[0]).toMatchObject({
        numero: "PROC-MULTI-01",
        ano: 2024,
        assunto: "Assunto linha 1",
        instituicaoId: instMulti.id,
        importacaoLoteId: lote.id,
        sourceRef: "row:2",
      });

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter).toMatchObject({
        nome: "Escola Alfa Candidata",
        municipio: "Florianópolis",
        uf: "SC",
      });
      expect(
        await prisma.processo.count({
          where: { instituicaoId: autoMatchId, deletedAt: null },
        }),
      ).toBe(0);

      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        uf: "SC",
        importacaoLoteId: lote.id,
      });
      expect(
        await prisma.processo.count({
          where: { instituicaoId: canonicalId, deletedAt: null },
        }),
      ).toBe(0);

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(3);
    });

    test("cenário multi-linha com rejeição parcial: linha válida persiste e unknown_tipo rejeita só o documento", async () => {
      const result = await runImportacaoCsv(
        runInput(csvMultiLinhaValidaERejeicaoUnknownTipo(), "smoke-multi-reject.csv"),
      );

      expect(result).toMatchObject({
        imported: 2,
        rejected: 1,
        errorsCount: 1,
      });

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote).toMatchObject({
        status: "COM_PENDENCIAS",
        contagemLidas: 2,
        contagemImportadas: 2,
        contagemRejeitadas: 1,
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 2, updated: 0 },
        processos: { created: 1, updated: 0 },
        documentos: { created: 0, updated: 0 },
      });

      const erros = lote.relatorioErros as Array<{
        rowNumber: number;
        message: string;
      }>;
      expect(erros).toHaveLength(1);
      expect(erros[0]).toMatchObject({
        rowNumber: 3,
        message: "documento_tipo não cadastrado no sistema",
      });

      const instOk = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_MULTI_OK },
      });
      expect(instOk).toMatchObject({
        nome: "Escola Multi Válida",
        importacaoLoteId: lote.id,
      });

      const processosOk = await prisma.processo.findMany({
        where: { instituicaoId: instOk.id, deletedAt: null },
      });
      expect(processosOk).toHaveLength(1);
      expect(processosOk[0]).toMatchObject({
        numero: "PROC-MULTI-OK",
        sourceRef: "row:2",
        instituicaoId: instOk.id,
      });

      expect(
        await prisma.documento.count({
          where: { instituicaoId: instOk.id, deletedAt: null },
        }),
      ).toBe(0);

      const instReject = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_C },
      });
      expect(instReject).toMatchObject({
        nome: "Escola Multi Rejeitada",
        importacaoLoteId: lote.id,
      });
      expect(
        await prisma.documento.count({
          where: { instituicaoId: instReject.id, deletedAt: null },
        }),
      ).toBe(0);

      expect(await prisma.documento.count({ where: { deletedAt: null } })).toBe(0);
    });

    test("cenário 3+ linhas: válida + reconciliação + rejeição parcial no mesmo lote", async () => {
      const { autoMatchId, canonicalId } = await seedReconciliationCandidates();

      const result = await runImportacaoCsv(
        runInput(
          csvMultiLinhaTresComportamentos(),
          "smoke-triple.csv",
          reconciliacoesPorLinhas({ 3: canonicalId }),
        ),
      );

      expect(result).toMatchObject({
        imported: 3,
        rejected: 1,
        errorsCount: 1,
      });

      const lote = await prisma.importacaoLote.findUniqueOrThrow({
        where: { id: result.loteId },
      });
      expect(lote).toMatchObject({
        status: "COM_PENDENCIAS",
        contagemLidas: 3,
        contagemImportadas: 3,
        contagemRejeitadas: 1,
      });
      expect(lote.relatorioImpacto).toMatchObject({
        instituicoes: { created: 2, updated: 1 },
        processos: { created: 1, updated: 0 },
        documentos: { created: 0, updated: 0 },
      });
      expect(lote.reconciliacoes).toEqual({ 3: canonicalId });

      const erros = lote.relatorioErros as Array<{
        rowNumber: number;
        message: string;
      }>;
      expect(erros).toHaveLength(1);
      expect(erros[0]).toMatchObject({
        rowNumber: 4,
        message: "documento_tipo não cadastrado no sistema",
      });

      const instLinha1 = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_TRIPLE_OK },
      });
      expect(instLinha1).toMatchObject({
        nome: "Escola Três Linhas Válida",
        importacaoLoteId: lote.id,
      });
      const procLinha1 = await prisma.processo.findMany({
        where: { instituicaoId: instLinha1.id, deletedAt: null },
      });
      expect(procLinha1).toHaveLength(1);
      expect(procLinha1[0]).toMatchObject({
        numero: "PROC-TRIPLE-01",
        sourceRef: "row:2",
        instituicaoId: instLinha1.id,
      });

      const autoAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: autoMatchId },
      });
      expect(autoAfter.nome).toBe("Escola Alfa Candidata");
      const canonicalAfter = await prisma.instituicao.findUniqueOrThrow({
        where: { id: canonicalId },
      });
      expect(canonicalAfter).toMatchObject({
        nome: "Escola Alfa",
        municipio: "Florianópolis",
        importacaoLoteId: lote.id,
      });
      expect(
        await prisma.processo.count({
          where: { instituicaoId: canonicalId, deletedAt: null },
        }),
      ).toBe(0);

      const instLinha3 = await prisma.instituicao.findUniqueOrThrow({
        where: { cnpj: INTEGRATION_CNPJ_C },
      });
      expect(instLinha3).toMatchObject({
        nome: "Escola Três Linhas Rejeitada",
        importacaoLoteId: lote.id,
      });
      expect(
        await prisma.documento.count({
          where: { instituicaoId: instLinha3.id, deletedAt: null },
        }),
      ).toBe(0);
      expect(
        await prisma.documento.count({
          where: { instituicaoId: instLinha1.id, deletedAt: null },
        }),
      ).toBe(0);

      expect(await prisma.instituicao.count({ where: { deletedAt: null } })).toBe(4);

      await assertImportacaoLoteAuditTrail(result.loteId, INTEGRATION_ACTOR_USER_ID, {
        imported: 3,
        rejected: 1,
        errorsCount: 1,
      });

      await assertEntidadeImportAudit(
        "instituicoes",
        instLinha1.id,
        lote.id,
        {
          acao: "CREATE",
          rowNumber: 2,
          actorUserId: INTEGRATION_ACTOR_USER_ID,
        },
      );
      await assertEntidadeImportAudit(
        "instituicoes",
        canonicalId,
        lote.id,
        {
          acao: "UPDATE",
          rowNumber: 3,
          actorUserId: INTEGRATION_ACTOR_USER_ID,
          reconciliadoPara: canonicalId,
        },
      );
      await assertEntidadeImportAudit(
        "instituicoes",
        instLinha3.id,
        lote.id,
        {
          acao: "CREATE",
          rowNumber: 4,
          actorUserId: INTEGRATION_ACTOR_USER_ID,
        },
      );
      await assertEntidadeImportAudit(
        "processos",
        procLinha1[0].id,
        lote.id,
        {
          acao: "CREATE",
          rowNumber: 2,
          actorUserId: INTEGRATION_ACTOR_USER_ID,
        },
      );

      const auditNoReconAuto = await prisma.logAuditoria.findMany({
        where: { entidade: "instituicoes", entidadeId: autoMatchId },
      });
      expect(auditNoReconAuto).toHaveLength(0);
    });

    test("cenário C: documento_tipo ausente no banco rejeita linha e mantém instituição gravada", async () => {
      const result = await runImportacaoCsv(
        runInput(csvDocumentoTipoNaoCadastrado(), "smoke-c.csv"),
      );

      expect(result.imported).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.errorsCount).toBe(1);

      const inst = await prisma.instituicao.findUnique({
        where: { cnpj: INTEGRATION_CNPJ_C },
      });
      expect(inst).toMatchObject({
        nome: "Escola Doc Tipo Pendente",
        deletedAt: null,
      });

      const docs = await prisma.documento.findMany({
        where: { instituicaoId: inst!.id, deletedAt: null },
      });
      expect(docs).toHaveLength(0);

      const lote = await prisma.importacaoLote.findUnique({
        where: { id: result.loteId },
      });
      expect(lote?.status).toBe("COM_PENDENCIAS");
      expect(lote?.contagemRejeitadas).toBe(1);

      const erros = lote?.relatorioErros as Array<{
        rowNumber: number;
        message: string;
      }> | null;
      expect(erros?.some((e) => e.message.includes("documento_tipo não cadastrado"))).toBe(
        true,
      );
    });
  },
);
