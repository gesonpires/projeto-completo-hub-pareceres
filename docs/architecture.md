# Arquitetura do MVP

## Objetivo
Definir a arquitetura técnica inicial do MVP com foco em uso interno, busca institucional inteligente, consolidação de dados históricos e extensibilidade futura.

## Princípios
- **Rastreabilidade por padrão**: toda entidade relevante tem auditoria e (quando importada) proveniência (fonte/lote).
- **Domínio antes de interface**: modelo e regras do domínio guiam ingestão, busca e relatórios.
- **MVP com extensão previsível**: escolhas simples agora, mas com “ganchos” para evoluir (storage, busca, integrações).
- **Database-first (em transição)**: o PostgreSQL é a fonte de verdade; consultas e mutações críticas convergem para camadas centrais em `web/src/server/`, conforme `docs/docs_database_first_transition_plan.md`.

## Stack adotada
- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Backend**: Next.js (API/Server) com camada de serviços modular (domínio)
- **Persistência**: PostgreSQL + Prisma ORM
- **Armazenamento de arquivos**: local no MVP (filesystem), com interface para troca futura
- **Relatórios**: HTML + exportação PDF
- **Busca**: Postgres (índices + full‑text quando necessário), ver `docs/search-spec.md`

## Limites e módulos (camadas)
### UI (Frontend)
- Páginas e componentes de navegação (RSC + Server Actions / rotas API como entrada)
- Formulários e validações de UX
- Visualização consolidada (linha do tempo institucional)
- Telas de importação: upload/preview/resultado

### API/Server (Backend)
- **Entrada (fina)**: Server Actions e Route Handlers — sessão, RBAC, parse de `FormData`/query string, redirect ou `NextResponse`
- **Read models** (`web/src/server/read-models/`): consultas críticas de leitura — ver seção abaixo e `docs/read-models-spec.md`
- **Mutation services** (`web/src/server/services/`): escrita transacional e auditoria — ver seção abaixo e `docs/mutation-services-spec.md`
- **Prisma + PostgreSQL**: persistência com migrações versionadas; `withPrismaRetry` em fluxos sensíveis
- **Infraestrutura**:
  - Storage de arquivos (local)
  - Geração de PDF
  - Parser/validador de importação (`web/src/server/imports/`)
  - Reconciliação (colisões, prévias em rotas dedicadas)
  - Auditoria (`web/src/server/audit.ts`: `auditLog`, `auditEvent`)

---

## Arquitetura de leitura (estado atual — Etapa 2)

Consultas críticas **não devem ser reimplementadas nas páginas**. Os loaders abaixo são a fonte única para os fluxos cobertos.

| Loader | Responsabilidade | Consumidores principais |
|--------|------------------|-------------------------|
| `loadInstitutionalReport` | Relatório consolidado (instituição + timeline + proveniência) | `/instituicoes/[id]/relatorio`, PDF |
| `loadInstitutionList` | Lista paginada com filtros e ordenação | `/instituicoes` |
| `loadGlobalSearch` | Busca global por abas, contagens e top 25 | `/busca` |
| `loadInstitutionDetail` | Ficha institucional (timeline, tramitações, proveniência por item) | `/instituicoes/[id]` |

**Padrões:** parse em `*Query.ts` (testável), retorno `{ status: "ok" \| "not_found" \| "db_error" }`, RBAC na página.  
**Detalhe:** especificação completa (entradas, limites, ordenação, performance, pendências) em `docs/read-models-spec.md`.

**Ainda fora dos read models (leitura local na página/rota):** listagem de export jobs de auditoria, `api/relatorios/instituicoes`, prévias `api/reconciliacao/preview/*`, combos de formulários (mantenedoras, upload em lote), módulos admin.

---

## Arquitetura de escrita (estado atual — Etapa 3 prioritária)

Mutações críticas dos fluxos abaixo passam por **serviços explícitos**; a action/rota valida permissão e delega.

| Serviço | Responsabilidade | Consumidores principais |
|---------|------------------|-------------------------|
| `instituicaoMutationsService` | CRUD na ficha: processo, ato, evento, documento, tramitação, mantenedora | `instituicoes/[id]/actions.ts` |
| `reconciliacaoAjustesService` | Ajustes em lote e merge instituição/processo pós-importação | `importacoes/[id]/ajustes/actions.ts` |
| `documentoLoteService` | Upload em lote (ZIP/arquivos) com vínculo e inferência | `documentos/lote/actions.ts` |
| `auditoriaExportJobService` | Jobs assíncronos de exportação de logs de auditoria | `auditoria/exports/actions.ts`, `api/auditoria/exports/*` |
| `mantenedoraMutationsService` | Cadastro e edição de mantenedora | `mantenedoras/nova/actions.ts`, `mantenedoras/[id]/actions.ts` |
| `importacaoCsvService` | Run, guardrails e preview de importação CSV/XLSX | `importacoes/nova/actions.ts` |

**Padrões:** regras e Prisma no serviço; `prisma.$transaction` quando há mutação + auditoria; `auditLog` / `auditEvent` com `TransactionClient` opcional; I/O de arquivo fora da transação SQL (MVP). CNPJ opcional: `mutationCnpjValidation.ts`.  
**Detalhe:** especificação completa em `docs/mutation-services-spec.md`.

**Ainda fora dos mutation services (S5):** admin de usuários/perfis; export síncrono JSON/CSV de auditoria. Importação CSV: `importacaoCsvService` (run + guardrails + preview); instituição/mantenedora manual: S1 / `mantenedoraMutationsService`.

---

## Transição database-first (progresso)

| Etapa | Status | Artefato |
|-------|--------|----------|
| 1 — Baseline Prisma/migrações | Concluída | `web/prisma/`, migration de sync |
| 2 — Read models P1–P4 | Concluída | `docs/read-models-spec.md` |
| 3 — Mutation services S1–S4 | Concluída (prioritários) | `docs/mutation-services-spec.md` |
| 4 — Endurecimento / S5 / unificação | Pendente | Plano em `docs/docs_database_first_transition_plan.md` |

## Autenticação e autorização (RBAC)
- **Autenticação**: login interno (mecanismo definido na implementação; no MVP, o requisito é “usuário autenticado”)
- **Autorização**: perfis e permissões por ação (CRUD, importar, administrar, auditar)
- Detalhes e matriz de permissões: `docs/rbac.md`

## Modelo de dados e auditoria
- Banco Postgres com Prisma, migrações versionadas.
- **Auditoria**:
  - Registro de ações (create/update/delete lógico) com usuário, timestamp e “antes/depois” (ou diff).
  - Auditoria é consultável por admins e usada para responsabilização.
- **Proveniência (lineage)**:
  - Registros importados referenciam `fonte_dados` e `importacao_lote`.
  - Mudanças manuais preservam o vínculo ao lote original quando aplicável.

## Armazenamento de arquivos (MVP)
- **Local**: filesystem do servidor do app.
- **Requisitos mínimos**:
  - Organização por lote/entidade (ex.: `storage/importacoes/<loteId>/...`)
  - Nomeação estável e sem PII desnecessária no path
  - Registro no banco: `documentos` com metadados e caminho/URI
- **Evolução**: interface de storage para futura troca por objeto (S3/MinIO).

## Observabilidade mínima
- **Logs estruturados** (request id, usuário, entidade/ação, duração)
- **Erros de importação**: sempre retornam relatório de inconsistências por lote
- **Métricas básicas** (opcional no MVP): tempo de busca, tempo de geração de PDF, volume por lote

## Busca (consulta + full‑text)
- **Primário**: consultas SQL/Prisma com filtros, paginação e ordenação.
- **Full‑text**: Postgres `tsvector` para campos textuais relevantes (ex.: nome institucional) quando necessário.
- **Índices**: definidos a partir do `docs/search-spec.md`.

## Diagramas (texto)
### Componentes (alvo atual)
```
UI (Next.js pages)
  → Entrada fina (Server Actions / Route Handlers: auth, RBAC, redirect/JSON)
       → Read models (consulta)          → Prisma/Postgres
       → Mutation services (escrita)    → Prisma/Postgres + auditLog/auditEvent
       → Módulos legados (imports, etc.)
  → Storage local (documentos, exports de auditoria)
  → PDF generator
```

### Fluxo: busca e relatório (leitura centralizada)
Usuário → `loadGlobalSearch` / `loadInstitutionList` → `loadInstitutionDetail` → `loadInstitutionalReport` (HTML/PDF)  
Escrita na ficha → `instituicaoMutationsService`

### Fluxo: importação e reconciliação
Usuário (Operador) → Upload CSV (legado) → Preview/validação → Importar lote → Ajustes/reconciliação via `reconciliacaoAjustesService` → Canônico no banco + auditoria

---

## Documentação de referência

| Documento | Conteúdo |
|-----------|----------|
| `docs/docs_database_first_transition_plan.md` | Plano por etapas (1–4), critérios e pendências |
| `docs/read-models-spec.md` | Loaders P1–P4: contratos, limites, consumidores |
| `docs/mutation-services-spec.md` | Serviços S1–S4: transações, auditoria, consumidores |
| `docs/domain-model.md` | Modelo de domínio |
| `docs/data-dictionary.md` | Dicionário de dados |
| `docs/rbac.md` | Perfis e permissões |
| `docs/search-spec.md` | Metas de busca e índices |
