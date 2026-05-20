import { describe, expect, test } from "vitest";
import { buildInstitutionalReportTimeline } from "../institutionalReportTimeline";
import type { InstitutionalReportInstituicao } from "../institutionalReportTypes";

function baseInstituicao(
  overrides: Partial<InstitutionalReportInstituicao> = {},
): InstitutionalReportInstituicao {
  return {
    id: "inst-1",
    nome: "Escola Teste",
    nomeNormalizado: "ESCOLA TESTE",
    cnpj: null,
    municipio: null,
    uf: null,
    situacao: null,
    endereco: null,
    mantenedoraId: null,
    fonteDadosId: null,
    importacaoLoteId: null,
    sourceRef: null,
    createdAt: new Date("2024-01-01"),
    createdBy: null,
    updatedAt: new Date("2024-01-01"),
    updatedBy: null,
    deletedAt: null,
    processos: [],
    atos: [],
    eventos: [],
    documentos: [],
    ...overrides,
  };
}

describe("buildInstitutionalReportTimeline", () => {
  test("ordena por data decrescente e desempata por tipo (ato antes de processo)", () => {
    const inst = baseInstituicao({
      processos: [
        {
          id: "p1",
          instituicaoId: "inst-1",
          numero: "1",
          ano: 2024,
          tipo: "CREDENCIAMENTO",
          status: "ABERTO",
          dataAbertura: new Date("2024-06-01"),
          dataConclusao: null,
          assunto: "Assunto processo",
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2024-06-01"),
          createdBy: null,
          updatedAt: new Date("2024-06-01"),
          updatedBy: null,
          deletedAt: null,
        },
      ],
      atos: [
        {
          id: "a1",
          instituicaoId: "inst-1",
          processoId: null,
          tipo: "PARECER",
          numero: "10",
          dataAto: new Date("2024-06-01"),
          ementa: "Ementa",
          descricao: null,
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2024-06-01"),
          createdBy: null,
          updatedAt: new Date("2024-06-01"),
          updatedBy: null,
          deletedAt: null,
        },
      ],
    });

    const timeline = buildInstitutionalReportTimeline(inst);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.kind).toBe("ato");
    expect(timeline[1]?.kind).toBe("processo");
  });

  test("usa createdAt quando processo não tem dataAbertura", () => {
    const inst = baseInstituicao({
      processos: [
        {
          id: "p1",
          instituicaoId: "inst-1",
          numero: null,
          ano: null,
          tipo: null,
          status: "ABERTO",
          dataAbertura: null,
          dataConclusao: null,
          assunto: null,
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2023-01-15"),
          createdBy: null,
          updatedAt: new Date("2023-01-15"),
          updatedBy: null,
          deletedAt: null,
        },
      ],
    });

    const timeline = buildInstitutionalReportTimeline(inst);
    expect(timeline[0]?.date).toEqual(new Date("2023-01-15"));
    expect(timeline[0]?.title).toContain("(sem número)");
  });

  test("inclui documentos com tipo e título", () => {
    const inst = baseInstituicao({
      documentos: [
        {
          id: "d1",
          tipoDocumentoId: "td1",
          instituicaoId: "inst-1",
          processoId: null,
          atoId: null,
          eventoId: null,
          titulo: "Ofício inicial",
          dataDocumento: new Date("2024-03-01"),
          arquivoNome: "oficio.pdf",
          arquivoMime: null,
          arquivoTamanho: null,
          storagePath: null,
          textoExtraido: null,
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2024-03-01"),
          createdBy: null,
          updatedAt: new Date("2024-03-01"),
          updatedBy: null,
          deletedAt: null,
          tipoDocumento: { id: "td1", codigo: "OFICIO", nome: "Ofício" },
        },
      ],
    });

    const timeline = buildInstitutionalReportTimeline(inst);
    expect(timeline[0]?.kind).toBe("documento");
    expect(timeline[0]?.title).toBe("OFICIO: Ofício inicial");
    expect(timeline[0]?.subtitle).toBe("oficio.pdf");
  });
});
