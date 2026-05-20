import { describe, expect, test } from "vitest";
import {
  createEmptyParityStore,
  PARITY_VALID_CNPJ,
  parityRow,
  parityRowSemCnpj,
  seedDocumento,
  seedEvento,
  seedInstituicao,
  seedProcesso,
  storeB1SingleSemCnpjCandidate,
  storeB2DualSemCnpjCandidates,
} from "./importacaoCsvParityFixtures";
import { resolveDocumento } from "../resolveDocumento";
import {
  computeParityRowImpact,
  instituicaoIdFromResolve,
  resolveAtoFromStore,
  resolveChildrenFromStore,
  resolveInstituicaoFromStore,
  toParityBucket,
  PARITY_POLICIES,
} from "./importacaoCsvParityHarness";
import {
  createParityStoreWithoutDocTipos,
  PARITY_ATO_DATA,
  storeAtoNumeroDivergence,
  storeReconciliationScenario,
} from "./importacaoCsvParityFixtures";

describe("importacaoCsvParity — instituição por CNPJ", () => {
  test("create new_cnpj: RUN e PREVIEW iguais", async () => {
    const row = parityRow({ cnpjDigits: PARITY_VALID_CNPJ });
    const store = createEmptyParityStore();

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(toParityBucket(run)).toBe("create");
    expect(toParityBucket(preview)).toBe("create");
    expect(run).toMatchObject({ reason: "new_cnpj" });
    expect(preview).toMatchObject({ reason: "new_cnpj" });
  });

  test("update cnpj_existing: RUN e PREVIEW iguais", async () => {
    const row = parityRow({ cnpjDigits: PARITY_VALID_CNPJ });
    const store = seedInstituicao(createEmptyParityStore(), {
      id: "inst-cnpj-existing",
      nomeNormalizado: "OUTRA",
      municipio: null,
      uf: null,
      cnpj: PARITY_VALID_CNPJ,
      deletedAt: null,
    });

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(toParityBucket(run)).toBe("update");
    expect(toParityBucket(preview)).toBe("update");
    expect(instituicaoIdFromResolve(run)).toBe("inst-cnpj-existing");
    expect(instituicaoIdFromResolve(preview)).toBe("inst-cnpj-existing");
  });

  test("reject CNPJ inválido: RUN e PREVIEW iguais", async () => {
    const row = parityRow({ cnpjDigits: "123" });
    const store = createEmptyParityStore();

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(run).toMatchObject({ outcome: "reject", reason: "invalid_cnpj" });
    expect(preview).toMatchObject({ outcome: "reject", reason: "invalid_cnpj" });
    expect(run).toHaveProperty("message");
    expect((preview as { message: string }).message).toBe(
      (run as { message: string }).message,
    );
  });
});

describe("importacaoCsvParity — instituição sem CNPJ", () => {
  test("B1 único candidato: RUN e PREVIEW mesmo instituicaoId e bucket", async () => {
    const row = parityRowSemCnpj();
    const store = storeB1SingleSemCnpjCandidate();

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(toParityBucket(run)).toBe("update");
    expect(toParityBucket(preview)).toBe("update");
    expect(instituicaoIdFromResolve(run)).toBe("inst-b1-only");
    expect(instituicaoIdFromResolve(preview)).toBe("inst-b1-only");
  });

  test("B2 dois candidatos: divergência intencional (expected difference)", async () => {
    const row = parityRowSemCnpj();
    const store = storeB2DualSemCnpjCandidates();

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(toParityBucket(run)).toBe("update");
    expect(toParityBucket(preview)).toBe("update");
    expect(instituicaoIdFromResolve(run)).toBe("inst-b2-with-cnpj");
    expect(instituicaoIdFromResolve(preview)).toBe("inst-b2-first");
    expect(instituicaoIdFromResolve(run)).not.toBe(
      instituicaoIdFromResolve(preview),
    );
  });
});

describe("importacaoCsvParity — filhos com instId fixo", () => {
  const instId = "inst-fixed";
  const procDate = new Date("2024-06-01T00:00:00.000Z");
  const evtDate = new Date("2024-07-01T00:00:00.000Z");

  test("processo, evento e documento: create quando ausentes no store", async () => {
    const row = parityRow({
      procNumero: "99",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
      eventoTipo: "PROTOCOLO",
      eventoData: evtDate,
      eventoDescricao: "Protocolo",
      hasEvento: true,
      docTipo: "OFICIO",
      docTitulo: "Ofício 1",
      hasDocumento: true,
    });
    const store = createEmptyParityStore();

    const children = await resolveChildrenFromStore(row, instId, store);
    expect(children).toEqual({
      processo: "create",
      evento: "create",
      documento: "create",
      ato: "skip",
    });
  });

  test("processo, evento e documento: update quando existem no store", async () => {
    const row = parityRow({
      procNumero: "99",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
      eventoTipo: "PROTOCOLO",
      eventoData: evtDate,
      eventoDescricao: "Protocolo",
      hasEvento: true,
      docTipo: "OFICIO",
      docTitulo: "Ofício 1",
      hasDocumento: true,
    });

    let store = createEmptyParityStore();
    store = seedProcesso(store, {
      id: "proc-1",
      instituicaoId: instId,
      numero: "99",
      ano: 2024,
      deletedAt: null,
    });
    store = seedEvento(store, {
      id: "evt-1",
      instituicaoId: instId,
      tipo: "PROTOCOLO",
      dataEvento: evtDate,
      descricao: "Protocolo",
      deletedAt: null,
    });
    store = seedDocumento(store, {
      id: "doc-1",
      instituicaoId: instId,
      tipoDocumentoId: "tipo-oficio",
      titulo: "Ofício 1",
      dataDocumento: null,
      deletedAt: null,
    });

    const children = await resolveChildrenFromStore(row, instId, store);
    expect(children).toEqual({
      processo: "update",
      evento: "update",
      documento: "update",
      ato: "skip",
    });
  });

  test("filhos com instId null: create por missing_instituicao", async () => {
    const row = parityRow({
      procNumero: "1",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
      hasEvento: true,
      eventoTipo: "PROTOCOLO",
      eventoData: procDate,
      eventoDescricao: "X",
      hasDocumento: true,
      docTipo: "OFICIO",
      docTitulo: "Doc",
    });

    const children = await resolveChildrenFromStore(row, null, createEmptyParityStore());
    expect(children).toEqual({
      processo: "create",
      evento: "create",
      documento: "create",
      ato: "skip",
    });
  });

  test("paridade filhos após B1: mesmo instId RUN/PREVIEW → mesmos buckets", async () => {
    const row = parityRowSemCnpj({
      procNumero: "10",
      procAnoRaw: "2023",
      procAno: 2023,
      hasProcesso: true,
    });
    const store = storeB1SingleSemCnpjCandidate();

    const runInst = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
    );
    const previewInst = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    const instIdRun = instituicaoIdFromResolve(runInst);
    const instIdPreview = instituicaoIdFromResolve(previewInst);
    expect(instIdRun).toBe(instIdPreview);

    const children = await resolveChildrenFromStore(row, instIdRun, store);
    const childrenAgain = await resolveChildrenFromStore(row, instIdPreview, store);
    expect(children).toEqual(childrenAgain);
  });
});

describe("importacaoCsvParity — ato (divergência numero RUN vs PREVIEW)", () => {
  const instId = "inst-fixed";

  test("RUN create / PREVIEW update quando só o numero difere na chave", async () => {
    const row = parityRow({
      atoTipo: "PARECER",
      atoNumero: "2",
      atoData: PARITY_ATO_DATA,
      hasAto: true,
    });
    const store = storeAtoNumeroDivergence(instId);

    const run = await resolveAtoFromStore(
      row,
      instId,
      PARITY_POLICIES.atoRun,
      store,
    );
    const preview = await resolveAtoFromStore(
      row,
      instId,
      PARITY_POLICIES.atoPreview,
      store,
    );

    expect(toParityBucket(run)).toBe("create");
    expect(toParityBucket(preview)).toBe("update");
    expect(run).toMatchObject({ reason: "not_found", policy: "run" });
    expect(preview).toMatchObject({ policy: "preview" });
  });
});

describe("importacaoCsvParity — reconciliação (divergência RUN vs PREVIEW)", () => {
  test("RUN com reconciliacao_manual vs PREVIEW auto-match", async () => {
    const row = parityRowSemCnpj();
    const store = storeReconciliationScenario();
    const rowNumber = 10;

    const run = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instRun,
      store,
      { rowNumber, reconciliacoes: { [rowNumber]: "inst-recon" } },
    );
    const preview = await resolveInstituicaoFromStore(
      row,
      PARITY_POLICIES.instPreview,
      store,
    );

    expect(run).toMatchObject({
      outcome: "update",
      reason: "reconciliation_manual",
      instituicaoId: "inst-recon",
    });
    expect(preview).toMatchObject({
      outcome: "update",
      reason: "match_sem_cnpj",
      instituicaoId: "inst-auto",
    });
    expect(instituicaoIdFromResolve(run)).not.toBe(instituicaoIdFromResolve(preview));
  });
});

describe("importacaoCsvParity — documento unknown_tipo", () => {
  const instId = "inst-fixed";

  test("resolver: unknown_tipo no store sem tipos", async () => {
    const row = parityRow({
      docTipo: "PARECER",
      docTitulo: "Doc",
      hasDocumento: true,
    });
    const store = createParityStoreWithoutDocTipos();

    const result = await resolveDocumento({
      instituicaoId: instId,
      tipoDocumentoId: null,
      row,
    });
    expect(result).toEqual({ outcome: "unknown_tipo" });
  });

  test("impacto: preview omite documento; run marca lineRejected", async () => {
    const row = parityRow({
      cnpjDigits: PARITY_VALID_CNPJ,
      docTipo: "PARECER",
      docTitulo: "Doc",
      hasDocumento: true,
    });
    const store = createParityStoreWithoutDocTipos();

    const previewImpact = await computeParityRowImpact(row, store, "preview");
    const runImpact = await computeParityRowImpact(row, store, "run");

    expect(previewImpact.lineRejected).toBe(false);
    expect(previewImpact.documentos).toEqual({ created: 0, updated: 0 });
    expect(previewImpact.instituicoes.created).toBe(1);

    expect(runImpact.lineRejected).toBe(true);
    expect(runImpact.documentos).toEqual({ created: 0, updated: 0 });
    expect(runImpact.instituicoes.created).toBe(1);
  });
});

describe("importacaoCsvParity — impacto agregado (resolvers)", () => {
  test("B1: preview e run com mesmos contadores de entidade", async () => {
    const row = parityRowSemCnpj({
      procNumero: "7",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
    });
    const store = storeB1SingleSemCnpjCandidate();

    const preview = await computeParityRowImpact(row, store, "preview");
    const run = await computeParityRowImpact(row, store, "run");

    expect(preview.lineExcluded).toBe(false);
    expect(run.lineExcluded).toBe(false);
    expect(preview.instituicoes).toEqual(run.instituicoes);
    expect(preview.processos).toEqual(run.processos);
  });

  test("B2: contadores de processo divergem quando instituicaoId diverge (expected)", async () => {
    const row = parityRowSemCnpj({
      procNumero: "8",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
    });
    let store = storeB2DualSemCnpjCandidates();
    store = seedProcesso(store, {
      id: "proc-on-run-inst",
      instituicaoId: "inst-b2-with-cnpj",
      numero: "8",
      ano: 2024,
      deletedAt: null,
    });

    const preview = await computeParityRowImpact(row, store, "preview");
    const run = await computeParityRowImpact(row, store, "run");

    expect(preview.instituicoes.updated).toBe(1);
    expect(run.instituicoes.updated).toBe(1);
    expect(preview.processos).toEqual({ created: 1, updated: 0 });
    expect(run.processos).toEqual({ created: 0, updated: 1 });
  });

  test("processo ano inválido: preview e run com mesmo impacto em B1", async () => {
    const row = parityRowSemCnpj({
      procNumero: "1",
      procAnoRaw: "abc",
      procAno: null,
      hasProcesso: true,
    });
    const store = storeB1SingleSemCnpjCandidate();

    const preview = await computeParityRowImpact(row, store, "preview");
    const run = await computeParityRowImpact(row, store, "run");

    expect(preview.processos).toEqual({ created: 1, updated: 0 });
    expect(run.processos).toEqual(preview.processos);
  });
});

describe("importacaoCsvParity — regressão (paridade esperada)", () => {
  test("mesmo instId e mesmas políticas de filho → buckets idênticos", async () => {
    const row = parityRow({
      procNumero: "1",
      procAnoRaw: "2024",
      procAno: 2024,
      hasProcesso: true,
      eventoTipo: "PROTOCOLO",
      eventoData: new Date("2024-01-01T00:00:00.000Z"),
      eventoDescricao: "E",
      hasEvento: true,
    });
    const instId = "inst-same";
    const store = createEmptyParityStore();

    const a = await resolveChildrenFromStore(row, instId, store, {
      atoPolicy: PARITY_POLICIES.atoRun,
    });
    const b = await resolveChildrenFromStore(row, instId, store, {
      atoPolicy: PARITY_POLICIES.atoRun,
    });
    expect(a).toEqual(b);
  });
});
