import { describe, expect, test } from "vitest";
import { createProvenanceFormatter } from "../institutionDetailProvenance";
import { buildInstitutionDetailTimeline } from "../institutionDetailTimeline";
import type { InstitutionDetailInstituicao } from "../institutionDetailTypes";

function baseInstituicao(
  overrides: Partial<InstitutionDetailInstituicao> = {},
): InstitutionDetailInstituicao {
  return {
    id: "inst-1",
    nome: "Escola",
    nomeNormalizado: "ESCOLA",
    cnpj: null,
    municipio: "Florianópolis",
    uf: "SC",
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
    mantenedora: null,
    processos: [],
    atos: [],
    eventos: [],
    documentos: [],
    ...overrides,
  };
}

describe("buildInstitutionDetailTimeline", () => {
  const formatProv = createProvenanceFormatter({
    fonteById: new Map(),
    loteById: new Map(),
  });

  test("ordena por data desc e desempata por tipo (ato antes de processo)", () => {
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
          assunto: null,
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2024-06-01"),
          createdBy: null,
          updatedAt: new Date("2024-06-01"),
          updatedBy: null,
          deletedAt: null,
          tramitacoes: [],
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
          ementa: null,
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

    const timeline = buildInstitutionDetailTimeline(inst, formatProv);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.kind).toBe("ato");
    expect(timeline[1]?.kind).toBe("processo");
  });

  test("inclui tramitação e documento com href de download", () => {
    const inst = baseInstituicao({
      processos: [
        {
          id: "p1",
          instituicaoId: "inst-1",
          numero: null,
          ano: null,
          tipo: null,
          status: "ABERTO",
          dataAbertura: new Date("2024-01-01"),
          dataConclusao: null,
          assunto: null,
          fonteDadosId: null,
          importacaoLoteId: null,
          sourceRef: null,
          createdAt: new Date("2024-01-01"),
          createdBy: null,
          updatedAt: new Date("2024-01-01"),
          updatedBy: null,
          deletedAt: null,
          tramitacoes: [
            {
              id: "t1",
              processoId: "p1",
              dataMovimento: new Date("2024-02-01"),
              deSetor: "A",
              paraSetor: "B",
              status: "ENCAMINHADO",
              observacao: null,
              fonteDadosId: null,
              importacaoLoteId: null,
              sourceRef: null,
              createdAt: new Date("2024-02-01"),
              createdBy: null,
              updatedAt: new Date("2024-02-01"),
              updatedBy: null,
              deletedAt: null,
            },
          ],
        },
      ],
      documentos: [
        {
          id: "d1",
          tipoDocumentoId: "td1",
          instituicaoId: "inst-1",
          processoId: null,
          atoId: null,
          eventoId: null,
          titulo: "Ofício",
          dataDocumento: new Date("2024-03-01"),
          arquivoNome: "of.pdf",
          arquivoMime: null,
          arquivoTamanho: null,
          storagePath: "/storage/of.pdf",
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

    const timeline = buildInstitutionDetailTimeline(inst, formatProv);
    const tram = timeline.find((t) => t.kind === "tramitacao");
    const doc = timeline.find((t) => t.kind === "documento");
    expect(tram?.title).toContain("Tramitação");
    expect(doc?.href).toBe("/api/documentos/d1/download");
  });
});
