# Especificação dos serviços de mutação (MVP)

Documento de consolidação da **Etapa 3 — serviços prioritários S1–S4**, alinhado ao plano em `docs/docs_database_first_transition_plan.md`.

**Escopo deste documento:** escrita centralizada já extraída para `web/src/server/services/`.  
**Fora de escopo:** read models (Etapa 2), fluxos ainda não extraídos (S5), alteração de comportamento.

---

## 1. Visão geral da arquitetura

### Camadas

| Camada | Responsabilidade | Exemplos |
|--------|------------------|----------|
| **UI / RSC** | Formulários, listagens, polling | `instituicoes/[id]/page.tsx`, `JobClient.tsx` |
| **Entrada (actions / API routes)** | Sessão, RBAC, parse de `FormData`/query, redirect ou `NextResponse` | `instituicoes/[id]/actions.ts`, `api/auditoria/exports/*` |
| **Serviço de mutação** | Regras de negócio, Prisma, auditoria, transações, I/O quando aplicável | `*Service.ts` em `web/src/server/services/` |
| **Infra compartilhada** | Auditoria, retry de conexão, normalização | `web/src/server/audit.ts`, `dbRetry.ts`, `normalize.ts` |

### Princípios adotados

1. A **action/rota não encapsula o domínio** — apenas orquestra entrada e saída.
2. Múltiplas escritas relacionadas no banco usam **`prisma.$transaction`** quando possível.
3. **`auditLog` / `auditEvent`** ocorrem no mesmo fluxo lógico da mutação; quando há transação, recebem `TransactionClient` opcional (`web/src/server/audit.ts`).
4. **I/O de arquivo** (storage local) permanece fora da transação SQL — comportamento MVP herdado.

### Formato de retorno dos serviços

Padrão discriminated union:

- `{ ok: true, ... }` — sucesso com identificadores para redirect ou resposta HTTP.
- `{ ok: false, error: string }` ou `{ ok: false, code: ... }` — falha de negócio (sem throw).

O chamador (action/rota) traduz em `redirect(?error=)` ou status HTTP.

### Ator

Todos os serviços recebem pelo menos `{ userId: string }`.  
`auditoriaExportJobService` também exige `{ isAdmin: boolean }` para autorização de acesso a jobs alheios.

**RBAC não é aplicado dentro do serviço** — fica na camada de entrada (`hasPermission`, `canReconcileImports`, `canReadAudit`).

---

## 2. Infraestrutura compartilhada

### Auditoria

| Função | Uso | Registro em `LogAuditoria` |
|--------|-----|----------------------------|
| `auditLog(params, tx?)` | CRUD com `antes`/`depois` | `acao`: CREATE, UPDATE, DELETE, RESTORE |
| `auditEvent(params, tx?)` | Eventos agregados / operação em lote | `acao`: UPDATE + `metadata.evento` |

### Retry

`withPrismaRetry` (`web/src/server/dbRetry.ts`) é usado em **reconciliacaoAjustesService** e **documentoLoteService** (evento final) e **auditoriaExportJobBuild** (leitura de logs).  
**instituicaoMutationsService** chama `prisma` diretamente (com transações).

---

## 3. S1 — `instituicaoMutationsService`

**Pasta:** `web/src/server/services/instituicaoMutations*`  
**Módulo principal:** `instituicaoMutationsService.ts`

### Escopo

Mutações da **ficha institucional** (`/instituicoes/[id]`): vínculo com mantenedora, CRUD de processos, atos, eventos, documentos e tramitações, incluindo soft delete/restore e upload unitário de arquivo.

Cobre também: **criação de nova instituição** (`createInstituicao`) — consumidor `instituicoes/nova/actions.ts`.

### Consumidores

| Consumidor | Funções |
|------------|---------|
| `web/src/app/instituicoes/[id]/actions.ts` | Mutações da ficha (21 actions) |
| `web/src/app/instituicoes/nova/actions.ts` | `createInstituicao` |

### Permissões (camada de entrada)

| Operação | Permissão |
|----------|-----------|
| Mantenedora | `institutions:write` |
| Processo | `processes:write` |
| Ato, evento, tramitação | `regulatory:write` |
| Documento | `documents:write` |

### API pública (funções)

| Função | Entidade principal |
|--------|-------------------|
| `createInstituicao` | `Instituicao` (cadastro inicial) |
| `updateInstituicaoMantenedora` | `Instituicao` |
| `createProcesso`, `updateProcesso`, `deleteProcesso`, `restoreProcesso` | `Processo` |
| `createAto`, `updateAto`, `deleteAto`, `restoreAto` | `AtoAutorizativo` |
| `createEvento`, `updateEvento`, `deleteEvento`, `restoreEvento` | `EventoRegulatorio` |
| `createDocumento`, `updateDocumento`, `deleteDocumento`, `restoreDocumento` | `Documento` |
| `createTramitacao`, `updateTramitacao`, `deleteTramitacao`, `restoreTramitacao` | `Tramitacao` |

Schemas Zod exportados de `instituicaoMutationsSchemas.ts`. Mensagens de validação: `firstZodIssueMessage` em `instituicaoMutationsValidation.ts`.

### Efeitos no banco

- **Instituição:** atualização de `mantenedoraId`, `updatedBy` (valida mantenedora ativa).
- **Filhos:** create/update com campos de formulário; delete/restore via `deletedAt`.
- **Documento com arquivo:** `create` → filesystem → `update` (metadados de arquivo); remoção de arquivo zera campos de storage (arquivo antigo permanece no disco — MVP).
- **Vínculos de documento:** no máximo um entre processo, ato ou evento; ato/evento com `processoId` propagam vínculo ao processo.

### Auditoria

| Operação | `entidade` | `acao` / evento |
|----------|------------|-----------------|
| CRUD padrão | `processos`, `atos_autorizativos`, `eventos_regulatorios`, `documentos`, `tramitacoes` | CREATE / UPDATE / DELETE / RESTORE |
| Cadastro instituição | `instituicoes` | CREATE (`createInstituicao`) |
| Mantenedora (vínculo) | `instituicoes` | UPDATE + `metadata.field: mantenedoraId` |
| Upload arquivo | `documentos` | UPDATE (`reason: upload_arquivo` / `reupload_arquivo` / `remover_arquivo`) + CREATE |

Tramitações incluem `metadata` com `instituicaoId` e `processoId`.

### Transação

- **Padrão:** mutação + `auditLog` na mesma `$transaction`.
- **Exceção — documento com arquivo:** `create` fora da transação; após I/O, `update` + `auditLog` UPDATE em transação; `auditLog` CREATE após o bloco (fora da transação do arquivo) — igual ao MVP anterior.
- **Exceção — `updateDocumento` só metadados:** `update` + `auditLog` sem transação envolvendo o update (apenas auditoria após update).

### Retorno

`InstituicaoMutationResult`: `{ ok: true, instituicaoId, redirectSuffix? }` — `redirectSuffix` = `?showDeleted=1` nos restores.

### Testes unitários

`web/src/server/services/__tests__/instituicaoMutationsValidation.test.ts` (inclui casos de `mutationCnpjValidation`)

---

## 4. S2 — `reconciliacaoAjustesService`

**Pasta:** `web/src/server/services/reconciliacaoAjustes*`  
**Módulo principal:** `reconciliacaoAjustesService.ts`

### Escopo

Ajustes pós-importação na tela **`/importacoes/[id]/ajustes`**: correções em lote e reconciliação (merge) de instituição ou processo importado para registro canônico.

Não cobre: ingestão CSV (`importacoes/nova`), prévias em `api/reconciliacao/preview/*` (somente leitura).

### Consumidores

| Consumidor | Funções |
|------------|---------|
| `web/src/app/importacoes/[id]/ajustes/actions.ts` | `updateInstituicoesBatch`, `updateProcessosBatch`, `mergeInstituicaoInto`, `mergeProcessoInto` |

### Permissões (camada de entrada)

`canReconcileImports(session.perfil)` em todas as actions.

### API pública

| Função | Descrição |
|--------|-----------|
| `updateInstituicoesBatch` | `updateMany` em instituições do lote (município/UF) |
| `updateProcessosBatch` | `updateMany` em processos do lote (status/assunto) |
| `mergeInstituicaoInto` | Move filhos do lote para instituição canônica; soft-delete origem |
| `mergeProcessoInto` | Move tramitações/atos/eventos/documentos; soft-delete processo origem |

Entrada de IDs em lote: JSON em string, parse por `parseBatchIdsJson` (máx. **500** ids).

### Efeitos no banco

- **Batch:** `updateMany` filtrado por `importacaoLoteId` + `deletedAt: null`.
- **Merge instituição:** origem com `importacaoLoteId = loteId`; destino com `importacaoLoteId = null`. Reatribui processos, atos, eventos e documentos **do lote**; `deletedAt` na instituição origem.
- **Merge processo:** origem no lote; destino canônico (`importacaoLoteId = null`). Reatribui tramitações, atos, eventos, documentos do lote.

### Regras de bloqueio (antes da transação)

- **Instituição:** colisão de `numero`+`ano` de processos do lote vs. destino (`collisionUtils`).
- **Processo:** colisão por `sourceRef` (documentos), chave ato (tipo/data/número), evento (tipo/data/descrição).

### Auditoria

Todos via **`auditEvent`** (não `auditLog` por registro):

| Evento | `entidade` | `entidadeId` |
|--------|------------|--------------|
| `IMPORT_AJUSTE_BATCH` | `instituicoes` ou `processos` | `loteId` |
| `IMPORT_RECONCILE_INSTITUICAO` | `instituicoes` | `loteId` |
| `IMPORT_RECONCILE_PROCESSO` | `processos` | `loteId` |

`metadata` inclui contagens (`moved`), ids origem/destino e filtros aplicados.

### Transação

- Batch: `updateMany` + `auditEvent` na mesma `$transaction`.
- Merge: múltiplos `updateMany` + soft-delete + `auditEvent` na mesma `$transaction`.
- Checagens de colisão: **fora** da transação (leitura prévia).

### Retorno

`ReconciliacaoAjusteResult`: `{ ok: true, loteId, okMessage? }` — mensagem detalhada nos merges.

### Testes unitários

`web/src/server/services/__tests__/reconciliacaoAjustesUtils.test.ts`  
Colisões: `web/src/server/reconcile/__tests__/collisionUtils.test.ts`

---

## 5. S3 — `documentoLoteService`

**Pasta:** `web/src/server/services/documentoLote*`  
**Módulo principal:** `documentoLoteService.ts`

### Escopo

Upload **em lote** de documentos (`/documentos/lote`): múltiplos arquivos ou ZIP, vínculo opcional a processo/ato/evento, inferência automática de processo pelo nome do arquivo.

Não cobre: documento unitário na ficha (S1) nem importação CSV de metadados.

### Consumidores

| Consumidor | Funções |
|------------|---------|
| `web/src/app/documentos/lote/actions.ts` | `uploadDocumentosEmLote`, `parseDocumentoLoteUploadFiles` |

### Permissões (camada de entrada)

`documents:write`

### API pública

| Função | Descrição |
|--------|-----------|
| `uploadDocumentosEmLote(actor, input, upload)` | Processa ZIP ou lista de arquivos |
| `parseDocumentoLoteUploadFiles(formData)` | Extrai `zipFile` e `files[]` |

Schema: `DocumentoLoteUploadSchema` (`documentoLoteSchemas.ts`).

### Efeitos no banco

Por arquivo aceito:

1. `Documento.create` com `sourceRef = UPLOAD_LOTE:{instituicaoId}:{nomeOriginal}`
2. Dedup: se já existir `sourceRef` ativo, arquivo é **pulado** (`skipped`)
3. Após gravar bytes em `storage/documentos/...`: `update` com `arquivoNome`, `mime`, `tamanho`, `storagePath`, `textoExtraido`
4. `auditLog` CREATE por documento

Ao final: **`auditEvent` `UPLOAD_LOTE`** agregado (`entidadeId` = `instituicaoId`).

### Inferência de processo (nome do arquivo)

Ordem: vínculo explícito do formulário → UUID no nome → `row:N` → número/ano → número único na instituição.  
Implementação: `documentoLoteFilenameInference.ts`.

### Limites (MVP)

| Limite | Valor |
|--------|-------|
| Arquivos no ZIP | 250 |
| Tamanho total ZIP | 250 MB |
| Entrada | ZIP **ou** arquivos soltos (não ambos) |

### Extração de texto

`documentoLoteTextExtraction.ts`: txt/csv/json/md e PDF (via `pdf-parse`), até 200k caracteres.

### Transação

Por arquivo: `create` → I/O → `$transaction(update + auditLog CREATE)`.  
Evento `UPLOAD_LOTE`: fora de transação por arquivo (`withPrismaRetry`).

### Retorno

`DocumentoLoteResult`: `{ ok: true, instituicaoId, successMessage }` — redirect para ficha da instituição com `?success=`.

### Testes unitários

`web/src/server/services/__tests__/documentoLoteFilenameInference.test.ts`

---

## 6. S4 — `auditoriaExportJobService`

**Pasta:** `web/src/server/services/auditoriaExportJob*`  
**Módulos:** `auditoriaExportJobService.ts`, `auditoriaExportJobBuild.ts`, `auditoriaExportJobQuery.ts`

### Escopo

Jobs **assíncronos** de exportação de `LogAuditoria` (CSV/JSON em `storage/auditoria-exports/`). Geração **on-demand** ao consultar job `PENDING` (MVP).

Não cobre: export síncrono imediato (`api/auditoria/export.json`, `export.csv`).

### Consumidores

| Consumidor | Funções |
|------------|---------|
| `web/src/app/auditoria/exports/actions.ts` | `createAuditoriaExportJob` |
| `web/src/app/api/auditoria/exports/route.ts` | `POST` → `createAuditoriaExportJob` |
| `web/src/app/api/auditoria/exports/[id]/route.ts` | `GET` → `getAuditoriaExportJob` |
| `web/src/app/api/auditoria/exports/[id]/download/route.ts` | `readAuditoriaExportDownload` |

Listagem de jobs na página `/auditoria/exports` ainda usa Prisma direto na RSC (somente leitura).

### Permissões (camada de entrada)

`canReadAudit`. Acesso a job de outro usuário: apenas **admin** (`isAdmin` passado ao serviço).

### API pública

| Função | Descrição |
|--------|-----------|
| `createAuditoriaExportJob` | Cria `AuditoriaExportJob` status `PENDING` |
| `getAuditoriaExportJob` | Status; se `PENDING`, executa geração |
| `readAuditoriaExportDownload` | Lê arquivo quando `DONE` |
| Helpers | `parseAuditoriaExportFiltros`, `parseAuditoriaExportFormat`, `clampAuditoriaExportLimit` |

### Modelo `AuditoriaExportJob`

| Campo | Uso |
|-------|-----|
| `status` | PENDING → RUNNING → DONE \| ERROR |
| `format` | CSV \| JSON |
| `filtros` | JSON: entidade, user (email), de, ate |
| `limit` | Máx. linhas exportadas |
| `arquivoPath` | Relativo `storage/auditoria-exports/{id}.{csv\|json}` |
| `criadoPor` | Dono do job |

### Limites de `limit` (camada de entrada — preservados)

| Entrada | Teto |
|---------|------|
| Form action | 200.000 |
| API POST | 50.000 (usuário) / 200.000 (admin) |

### Efeitos no banco e filesystem

1. **Create:** insert job + `auditEvent` `EXPORT_ASYNC_CREATE`
2. **Run (on GET se PENDING):** update RUNNING → query `LogAuditoria` → write file → update DONE + `EXPORT_ASYNC_DONE` **ou** ERROR + `EXPORT_ASYNC_ERROR`
3. **Download:** read file + `auditEvent` `EXPORT_ASYNC_DOWNLOAD` (sem transação com job)

### Transação

- Create / DONE / ERROR: mutação de job + `auditEvent` na mesma `$transaction`.
- Geração do arquivo: **fora** da transação (leitura + `writeFile`).

### Retorno

- `CreateAuditoriaExportJobResult`: `{ ok: true, id, status }`
- `GetAuditoriaExportJobResult`: job completo ou `not_found` / `forbidden`
- `ReadAuditoriaExportDownloadResult`: bytes + headers ou códigos de erro HTTP mapeados na rota

### Testes unitários

`web/src/server/services/__tests__/auditoriaExportJobQuery.test.ts`

---

## 7. Mapa de arquivos

```
web/src/server/services/
├── instituicaoMutationsService.ts      # S1
├── instituicaoMutationsSchemas.ts
├── instituicaoMutationsTypes.ts
├── instituicaoMutationsValidation.ts
├── instituicaoMutationsDocumentStorage.ts
├── mutationCnpjValidation.ts           # S1/S5 compartilhado
├── mantenedoraMutationsService.ts      # S5
├── mantenedoraMutationsSchemas.ts
├── mantenedoraMutationsTypes.ts
├── importacaoCsvService.ts             # S5 (run)
├── importacaoCsvTypes.ts
├── importacaoCsvSchemas.ts
├── importacaoCsvRunValidation.ts       # S5 Fase 2 (guardrails do run)
├── importacaoCsvPreviewService.ts      # S5 Fase 3A (preview)
├── importacaoCsvPreviewTypes.ts
├── importacaoCsvPreviewDryRun.ts
├── importacaoCsvPreviewSugestoes.ts
├── importacaoCsvMatching/
│   ├── importRowTypes.ts
│   ├── importRowNormalize.ts
│   ├── importMatchWhere.ts
│   ├── resolveProcesso.ts
│   ├── resolveEvento.ts
│   ├── resolveDocumento.ts
│   ├── resolveAto.ts
│   └── resolveInstituicao.ts
├── reconciliacaoAjustesService.ts      # S2
├── reconciliacaoAjustesSchemas.ts
├── reconciliacaoAjustesTypes.ts
├── reconciliacaoAjustesUtils.ts
├── documentoLoteService.ts             # S3
├── documentoLoteSchemas.ts
├── documentoLoteTypes.ts
├── documentoLoteFilenameInference.ts
├── documentoLoteTextExtraction.ts
├── documentoLoteStorage.ts
├── auditoriaExportJobService.ts        # S4
├── auditoriaExportJobBuild.ts
├── auditoriaExportJobQuery.ts
├── auditoriaExportJobTypes.ts
└── __tests__/
```

**Infra relacionada:** `web/src/server/audit.ts`, `web/src/server/reconcile/collisionUtils.ts`, `web/src/server/services/mutationCnpjValidation.ts`

---

## 8. S5 (parcial) — `mantenedoraMutationsService`

**Pasta:** `web/src/server/services/mantenedoraMutations*`  
**Módulo principal:** `mantenedoraMutationsService.ts`

### Escopo

Cadastro e edição de **mantenedoras** (`/mantenedoras/nova`, `/mantenedoras/[id]`). Validação de CNPJ opcional via `validateOptionalCnpj` (`mutationCnpjValidation.ts`), compartilhado com `createInstituicao`.

Não cobre: soft delete/restore de mantenedora (não existe no MVP).

### Consumidores

| Consumidor | Funções |
|------------|---------|
| `web/src/app/mantenedoras/nova/actions.ts` | `createMantenedora` |
| `web/src/app/mantenedoras/[id]/actions.ts` | `updateMantenedora` |

### Permissões (camada de entrada)

`maintainers:write` em ambas as actions.

### API pública

| Função | Entidade |
|--------|----------|
| `createMantenedora` | `Mantenedora` |
| `updateMantenedora` | `Mantenedora` |

### Auditoria

| Operação | `entidade` | `acao` |
|----------|------------|--------|
| Create | `mantenedoras` | CREATE |
| Update | `mantenedoras` | UPDATE (`antes`/`depois`) |

Mutação + `auditLog` na mesma `$transaction`.

### Retorno

`MantenedoraMutationResult`: `{ ok: true, mantenedoraId, redirectSuffix? }` — `redirectSuffix` = `?ok=1` no update.

---

## 8b. S5 (parcial) — `importacaoCsvService`

**Pasta:** `web/src/server/services/importacaoCsv*`  
**Módulo principal:** `importacaoCsvService.ts`

### Escopo

**Fase 1 — Run:** `runImportacaoCsv` — cria `FonteDados`/`ImportacaoLote`, loop de linhas, proveniência, auditoria, relatório final.

**Fase 2 — Validação de entrada do run** (`importacaoCsvRunValidation.ts`):

| Função | Papel |
|--------|--------|
| `parseImportSourceInfo` | `sourceInfoJson` → `arquivoTipo` / `arquivoMeta` |
| `assertCsvReadyForImport` | Headers, colunas críticas, `previewCsvMvp(1)` |
| `parseReconciliacoesJson` | Mapa linha → id / `NEW` |

Schema HTTP: `ImportacaoCsvRunFormSchema` em `importacaoCsvSchemas.ts`.

**Fase 3A — Preview** (`importacaoCsvPreviewService.ts`, `importacaoCsvPreviewDryRun.ts`, `importacaoCsvPreviewSugestoes.ts`, `imports/importacaoFileIngestion.ts`):

| Função | Papel |
|--------|--------|
| `previewImportacaoCsvFromUpload` | Upload → ingestão → preview completo |
| `previewImportacaoCsv` | Preview a partir de `csvText` + `sourceInfo` |
| `buildImportacaoCsvDryRunImpact` | Estimativa create/update (até 200 linhas da amostra) |
| `buildImportacaoCsvReconciliationSuggestions` | Candidatos de reconciliação sem CNPJ |
| `ingestImportUploadFile` | XLSX → CSV, encoding latin1 em CSV |

`previewImportAction`: auth + delegação a `previewImportacaoCsvFromUpload`.

**Fase 3B.1 — Normalização compartilhada** (`importacaoCsvMatching/importRowNormalize.ts`):

- `normalizeImportRow(CsvMvpRow)` → `NormalizedImportRow` (parsers de `csvMvpCore` + `normalize*`).
- `getInstituicaoCnpjRejectionMessage` para validação de CNPJ no run.
- Consumido por `runImportacaoCsv` e `buildImportacaoCsvDryRunImpact` antes de queries.

**Fase 3B.2 — Match keys compartilhados** (`importacaoCsvMatching/importMatchWhere.ts`):

- `buildInstituicaoWhereSemCnpj`, `buildProcessoWhere`, `buildAtoWhere`, `buildEventoWhere`, `buildDocumentoWhere`
- `buildAtoWhere` — uso via `resolveAto` / `planAtoMatch` e política `run` \| `preview`

**Fase 3B.3 (parcial) — Resolvers read-only** (`importacaoCsvMatching/resolve*.ts`):

| Resolver | Saídas |
|----------|--------|
| `resolveProcesso` | `skip` \| `create` (reason) \| `update` |
| `resolveEvento` | `skip` \| `create` (reason) \| `update` |
| `resolveDocumento` | `skip` \| `unknown_tipo` \| `create` (reason) \| `update` |
| `resolveAto` | `skip` \| `create` (reason) \| `update` + `policy` (`run` \| `preview`) |
| `resolveInstituicao` | `skip` \| `reject` \| `create` (reason) \| `update` (reason + `matchStrategy`) — **só run** (3B.4 p.1) |

- Run e dry-run compartilham estrutura de decisão nas entidades filhas
- `resolveInstituicao`: `INSTITUICAO_MATCH_POLICY_RUN` (`findMany` + preferência CNPJ + reconciliação) \| `INSTITUICAO_MATCH_POLICY_PREVIEW` (`findFirst` sem CNPJ)
- Dry-run instituição (3B.4-2B): `resolveInstituicao` com política `preview`
- Testes de paridade (store em memória): `importacaoCsvMatching/__tests__/importacaoCsvParity*.ts` — CNPJ, B1/B2, filhos, ato numero, reconciliação RUN-only, `unknown_tipo`, `computeParityRowImpact`
- Pendente: reconciliação no dry-run (produto), `findMany` no preview, E2E Prisma, contrato `rejected` no impacto da UI

### Consumidor

| Consumidor | Função |
|------------|--------|
| `web/src/app/importacoes/nova/actions.ts` (`runImportAction`) | `runImportacaoCsv` |

### API

| Função | Entrada | Saída |
|--------|---------|--------|
| `runImportacaoCsv` | `ImportacaoCsvRunInput` | `ImportacaoCsvRunResult` |

`ImportacaoCsvRunInput`: `csvText`, `actorUserId`, `arquivoNome`, `arquivoTipo?`, `arquivoMeta?`, `fonteNome?`, `reconciliacoes?`.

`ImportacaoCsvRunResult`: `loteId`, `imported`, `rejected`, `errorsCount`.

Erro de parse CSV: `throw new Error(...)` (comportamento MVP herdado).

### Compatibilidade

`web/src/server/imports/csvMvp.ts` reexporta `runCsvMvpImport` como alias de `runImportacaoCsv`.

---

## 9. Escrita ainda fora dos serviços (S5 — pendente)

Fluxos com `actions.ts` ou APIs que **ainda não** passam por `web/src/server/services/`:

| Área | Arquivo(s) | Observação |
|------|------------|------------|
| ~~Nova instituição~~ | ~~`instituicoes/nova/actions.ts`~~ | Extraído para S1 (`createInstituicao`) |
| ~~Nova mantenedora / edição~~ | ~~`mantenedoras/nova/actions.ts`, `mantenedoras/[id]/actions.ts`~~ | Extraído para `mantenedoraMutationsService` |
| ~~Importação CSV MVP (preview)~~ | ~~`importacoes/nova/actions.ts`~~ | `importacaoCsvPreviewService` |
| ~~Importação CSV MVP (run + guardrails)~~ | ~~`importacoes/nova/actions.ts`~~ | `runImportacaoCsv` + `importacaoCsvRunValidation` |
| Admin usuários | `admin/usuarios/actions.ts` | |
| Admin perfis | `admin/perfis/actions.ts` | |
| Login | `login/actions.ts` | Sessão (escopo diferente) |
| Export auditoria síncrono | `api/auditoria/export.json`, `export.csv` | Poderia reutilizar `buildLogAuditoriaWhere` |
| Relatório PDF | `api/instituicoes/[id]/relatorio.pdf` | Apenas `auditEvent` de leitura |

---

## 10. Pendências e refinamentos recomendados

### Arquitetura / código

- [ ] Extrair **`resolveDocumentoVinculos`** compartilhado entre S1 e S3 (hoje duplicado).
- [ ] Unificar política de **`withPrismaRetry`** em S1 (hoje só transação direta).
- [ ] Transação única por documento com arquivo (create + update + audits) sem janela inconsistente.
- [ ] **Worker/ fila** real para `AuditoriaExportJob` em vez de gerar no `GET`.
- [ ] Mover listagem de jobs (`/auditoria/exports`) para read model ou método de consulta no serviço.
- [ ] Testes de integração com banco (serviços hoje cobertos sobretudo por testes de helpers).

### Documentação complementar

- [ ] `read-models-spec.md` (Etapa 2 — ainda não produzido).
- [ ] Diagrama de estados do `AuditoriaExportJob` na UI.
- [ ] Tabela de eventos de auditoria (`metadata.evento`) como vocabulário estável.

### Etapa 4 (plano geral)

- Endurecimento de FKs/constraints, índices, unificação API ↔ actions, política arquitetural formal em `docs/architecture.md`.

---

## 11. Referências

- Plano de transição: `docs/docs_database_first_transition_plan.md` (§8 Etapa 3, §9 Etapa 4)
- Modelo de domínio: `docs/domain-model.md`
- Dicionário de dados: `docs/data-dictionary.md`
- Schema Prisma: `web/prisma/schema.prisma`
- RBAC: `docs/rbac.md` (se existir) / `web/src/server/permissions.ts`

---

*Versão: 1.0 — consolidada a partir do código em `web/src/server/services/` após conclusão de S1–S4.*
