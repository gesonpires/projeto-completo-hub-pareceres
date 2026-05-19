# Especificação dos read models (MVP)

Documento de consolidação da **Etapa 2 — reorganização da leitura**, alinhado ao plano em `docs/docs_database_first_transition_plan.md` e complementar a `docs/mutation-services-spec.md`.

**Escopo:** read models implementados em `web/src/server/read-models/`.  
**Fora de escopo:** alteração de comportamento, S5 de escrita, novas extrações estruturais.

---

## 1. Visão geral

### Camadas

| Camada | Responsabilidade | Exemplos |
|--------|------------------|----------|
| **Página RSC / API route** | Sessão, RBAC, layout, redirect/HTTP | `instituicoes/page.tsx`, `relatorio.pdf/route.ts` |
| **Read model (loader)** | Parse de query, Prisma/SQL, projeção, agregação em memória | `loadInstitutionList`, `loadGlobalSearch` |
| **Módulos auxiliares** | Query pura, timeline, proveniência (testáveis sem DB) | `*Query.ts`, `*Timeline.ts` |
| **Infra** | Normalização, retry | `normalize.ts`, `withPrismaRetry` |

### Princípios adotados

1. Telas e rotas **não montam consultas Prisma ad hoc** para os fluxos cobertos — chamam um loader explícito.
2. Parsing de `searchParams` fica em `*Query.ts` quando possível (funções puras, testáveis com Vitest).
3. Retorno tipado com **status** (`ok` | `not_found` | `db_error`) para a UI tratar erro de banco sem throw.
4. **RBAC** é aplicado na página (e, na busca global, repassado como `permissions`); os loaders não autenticam sozinhos.
5. Reuso entre HTML e PDF (relatório) e entre contagens/resultados (busca) evita divergência de filtros.

### Formato de retorno típico

```ts
| { status: "ok"; ...dados }
| { status: "not_found" }      // quando aplicável
| { status: "db_error" }
```

---

## 2. Mapa de arquivos

```
web/src/server/read-models/
├── institutionalReport.ts              # P1 loader
├── institutionalReportTypes.ts
├── institutionalReportTimeline.ts
├── institutionList.ts                  # P2 loader
├── institutionListTypes.ts
├── institutionListQuery.ts
├── globalSearch.ts                     # P3 loader
├── globalSearchTypes.ts
├── globalSearchQuery.ts
├── institutionDetail.ts                # P4 loader
├── institutionDetailTypes.ts
├── institutionDetailQuery.ts
├── institutionDetailTimeline.ts
├── institutionDetailProvenance.ts
└── __tests__/
    ├── institutionalReportTimeline.test.ts
    ├── institutionListQuery.test.ts
    ├── globalSearchQuery.test.ts
    ├── institutionDetailQuery.test.ts
    └── institutionDetailTimeline.test.ts
```

---

## 3. P1 — `loadInstitutionalReport`

### 1. Nome

`loadInstitutionalReport` — relatório institucional consolidado (P1).

### 2. Arquivo

| Papel | Caminho |
|-------|---------|
| Loader | `web/src/server/read-models/institutionalReport.ts` |
| Tipos / include | `institutionalReportTypes.ts` |
| Timeline | `institutionalReportTimeline.ts` |

### 3. Objetivo

Produzir **uma visão consolidada** da instituição para relatório HTML e PDF: entidade com filhos regulatórios, linha do tempo unificada, contadores e texto de proveniência da instituição.

### 4. Entrada

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `instituicaoId` | `string` (UUID) | ID da instituição |

Sem `searchParams`. Apenas registros com `deletedAt: null` nos filhos incluídos.

### 5. Saída

`LoadInstitutionalReportResult`:

| Status | Campos |
|--------|--------|
| `ok` | `report: { instituicao, timeline, provenance, counts }` |
| `not_found` | Instituição inexistente ou excluída |
| `db_error` | Falha Prisma (após retry) |

- **`instituicao`:** payload Prisma com `processos`, `atos`, `eventos`, `documentos` (+ `tipoDocumento`).
- **`timeline`:** `InstitutionalReportTimelineItem[]` (processo, ato, evento, documento — **sem tramitação**).
- **`provenance`:** `{ text, loteId }` da própria instituição (fonte/lote/ref).
- **`counts`:** totais por tipo (length dos arrays carregados).

Helpers exportados: `institutionalReportCounts`, `buildInstitutionalReportTimeline`.

### 6. Consumidores

| Consumidor | Uso |
|------------|-----|
| `web/src/app/instituicoes/[id]/relatorio/page.tsx` | Página HTML do relatório |
| `web/src/app/api/instituicoes/[id]/relatorio.pdf/route.ts` | Geração PDF (mesma fonte de dados) |

### 7. Origem dos dados

| Entidade Prisma | Filtro | Include / select |
|-----------------|--------|------------------|
| `Instituicao` | `id`, `deletedAt: null` | `institutionalReportInclude` |
| `Processo` | `deletedAt: null` | ordenado por `dataAbertura`, `createdAt` |
| `AtoAutorizativo` | `deletedAt: null` | `dataAto` desc |
| `EventoRegulatorio` | `deletedAt: null` | `dataEvento` desc |
| `Documento` | `deletedAt: null` | `tipoDocumento`, `dataDocumento` desc |
| `FonteDados` / `ImportacaoLote` | opcional | lookup para proveniência da instituição |

`withPrismaRetry` na carga principal e na proveniência.

### 8. Paginação / limites

**Sem paginação.** Todos os filhos ativos da instituição são carregados em uma única consulta (sem `take` no include). Instituições com histórico muito grande podem gerar resposta pesada — ver performance.

### 9. Ordenação

**Filhos no SQL:** conforme `institutionalReportInclude` (datas desc por tipo).

**Timeline em memória** (`buildInstitutionalReportTimeline`):

1. Data decrescente  
2. Tipo: ato → evento → processo → documento  
3. `id` lexicográfico  

### 10. Observações de performance

- Consulta **1 + N implícito** via include profundo; volume proporcional ao tamanho do histórico.
- Proveniência: até 2 queries adicionais (`fonteDados`, `importacaoLote`); falha silenciosa → texto vazio.
- PDF e HTML compartilham o loader — garante paridade, mas duplica custo se ambos forem acessados em sequência sem cache.
- Índices úteis: FKs em `instituicaoId`, `deletedAt`, datas de ordenação.

### 11. Pendências

- [ ] Introduzir **`take` / paginação** ou relatório “resumido vs completo” para instituições grandes.
- [ ] Incluir **mantenedora** e tramitações se o relatório evoluir para paridade com a ficha.
- [ ] Extrair read model para `api/relatorios/instituicoes` (hoje Prisma direto na rota).
- [ ] Cache por `instituicaoId` (curto TTL) para PDF repetido.

---

## 4. P2 — `loadInstitutionList`

### 1. Nome

`loadInstitutionList` — lista paginada de instituições (P2).

### 2. Arquivo

| Papel | Caminho |
|-------|---------|
| Loader | `web/src/server/read-models/institutionList.ts` |
| Tipos | `institutionListTypes.ts` |
| Query / where / order | `institutionListQuery.ts` |

### 3. Objetivo

Listagem principal em `/instituicoes` com filtros, ordenação, paginação e projeção resumida (`_count.processos`).

### 4. Entrada

`InstitutionListSearchParams` (query string da página):

| Parâmetro | Descrição |
|-----------|-----------|
| `q` | Texto livre (nome normalizado; até 8 termos AND) |
| `cnpj` | CNPJ explícito; ou inferido de `q` se 14 dígitos |
| `municipio`, `uf` | Filtros geográficos |
| `situacao` | Enum `InstituicaoSituacao` |
| `tem_processos` | `1` / `0` / vazio |
| `eventos_de`, `eventos_ate` | Datas `YYYY-MM-DD` (atos ou eventos) |
| `sort` | `nome` (default), `mais_processos`, `mais_recentes` |
| `dir` | `asc` (default) ou `desc` |
| `page` | Página (default 1) |

Parse: `parseInstitutionListQuery`. Helpers de URL: `buildInstitutionListSearchParams`.

### 5. Saída

`LoadInstitutionListResult`:

| Status | Campos |
|--------|--------|
| `ok` | `items`, `total`, `page`, `pageSize`, `totalPages`, `query` |
| `db_error` | — |

`InstitutionListItem`: `id`, `nome`, `cnpj`, `municipio`, `uf`, `_count.processos` (ativos).

### 6. Consumidores

| Consumidor | Uso |
|------------|-----|
| `web/src/app/instituicoes/page.tsx` | Listagem e paginação |

### 7. Origem dos dados

| Caminho | Quando |
|---------|--------|
| `prisma.instituicao.count({ where })` | Total para paginação |
| `prisma.instituicao.findMany` + `buildInstitutionListOrderBy` | `sort` = `nome` ou `mais_processos` |
| `prisma.$queryRaw` | `sort` = `mais_recentes` (subselects em atos/eventos) |

`where`: `buildInstitutionListWhere` — `deletedAt: null`, termos em `nomeNormalizado`, etc.

Select: `institutionListSummarySelect`.

### 8. Paginação / limites

| Constante | Valor |
|-----------|--------|
| `INSTITUTION_LIST_PAGE_SIZE` | **25** |
| `skip` | `(page - 1) * pageSize` |
| Termos em `q` | máx. **8** |

`mais_recentes`: mesma página/offset; IDs via SQL depois `findMany` por `in` (preserva ordem).

### 9. Ordenação

| `sort` | Comportamento |
|--------|----------------|
| *(default)* / `nome` | `nomeNormalizado`, `id` |
| `mais_processos` | `_count.processos`, `nomeNormalizado`, `id` |
| `mais_recentes` | `GREATEST(MAX(dataAto), MAX(dataEvento))` + `nomeNormalizado`, `id` |

Direção: `dir` asc/desc (default asc).

### 10. Observações de performance

- `count` + `findMany` por requisição (2 round-trips; `mais_recentes` pode ser 3).
- `mais_recentes` usa SQL raw com subconsultas correlacionadas — monitorar em bases grandes.
- Filtro por termos em `nomeNormalizado` sem índice full-text — `contains` sequencial (AND).
- `tem_processos` e filtro de eventos usam `EXISTS` — adequado com índices em FK + `deletedAt`.

### 11. Pendências

- [ ] Documentar / validar valores válidos de `situacao` na UI (cast `as never` no where).
- [ ] Índice composto ou materialized view para `mais_recentes` se lento.
- [ ] Opcional: busca por mantenedora na listagem (fora do MVP atual).

---

## 5. P3 — `loadGlobalSearch`

### 1. Nome

`loadGlobalSearch` — busca global com abas (P3).

### 2. Arquivo

| Papel | Caminho |
|-------|---------|
| Loader | `web/src/server/read-models/globalSearch.ts` |
| Tipos | `globalSearchTypes.ts` |
| Parse / where / abas | `globalSearchQuery.ts` |

### 3. Objetivo

Tela `/busca`: dado texto `q` e aba `tab`, retorna **contagens por entidade** e **até 25 resultados** da aba efetiva, respeitando permissões de leitura.

### 4. Entrada

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `searchParams` | `GlobalSearchSearchParams` | `q?`, `tab?` |
| `permissions` | `GlobalSearchPermissions` | `canInst`, `canProc`, `canReg`, `canDocs` |

Parse: `parseGlobalSearchQuery`. Aba efetiva: `resolveGlobalSearchEffectiveTab` (explícita ou heurística).

**Heurísticas em `q` (resumo):** UF (token 2 letras), CNPJ (14 dígitos), processo `número/ano`, ato `TIPO número`, documento `TIPO termo`, termos de nome (≥3 caracteres, até 8 termos).

### 5. Saída

`LoadGlobalSearchResult`:

| Status | Campos |
|--------|--------|
| `ok` | `query`, `effectiveTab`, `counts`, `results` |
| `db_error` | — |

`results` contém arrays por aba; apenas a **aba ativa** é preenchida quando `hasQuery`.  
`counts`: totais por aba (0 se sem permissão ou sem query).

Helpers de URL: `buildGlobalSearchTabHref`, `buildGlobalSearchReturnTo`, `buildGlobalSearchQueryString`.

### 6. Consumidores

| Consumidor | Uso |
|------------|-----|
| `web/src/app/busca/page.tsx` | Busca global |

### 7. Origem dos dados

Para `hasQuery`:

1. **5× `count`** em paralelo (instituição, processo, ato, evento, documento) — só abas permitidas.
2. **1× `findMany`** na `effectiveTab` com `buildGlobalSearchWhereClauses`.

Entidades: `Instituicao`, `Processo`, `AtoAutorizativo`, `EventoRegulatorio`, `Documento` (com `instituicao` e `tipoDocumento` quando necessário).  
Todas com `deletedAt: null` nos wheres montados.

### 8. Paginação / limites

| Constante | Valor |
|-----------|--------|
| `GLOBAL_SEARCH_RESULT_LIMIT` | **25** por aba |

Sem paginação de resultados — “top 25” da aba ativa. Contagens são totais (podem ser caras).

### 9. Ordenação

| Aba | `orderBy` |
|-----|-----------|
| Instituições | `nomeNormalizado` asc |
| Processos | `updatedAt` desc |
| Atos | `dataAto` desc |
| Eventos | `dataEvento` desc |
| Documentos | `updatedAt` desc |

Aba automática quando `tab` omitido: prioridade processo (número/ano), ato tipado, documento, instituição (ver `resolveGlobalSearchEffectiveTab`).

### 10. Observações de performance

- Até **6 queries** por busca com texto (`5 count` + `1 findMany`).
- Contagens executadas mesmo se o usuário só visualiza uma aba — trade-off para badges nas abas.
- Sem busca full-text; `contains` em `nomeNormalizado`, email do ator (documentos), etc.
- Plano de transição cita **INEP** e **mantenedora** — **não implementados** neste read model.

### 11. Pendências

- [ ] Suporte a **mantenedora** e **INEP** se entrarem no domínio de busca.
- [ ] Paginação “carregar mais” na aba ativa.
- [ ] Reduzir custo: contagens lazy ou amostragem quando `q` muito amplo.
- [ ] Unificar wheres com listagem/relatório onde fizer sentido.

---

## 6. P4 — `loadInstitutionDetail`

### 1. Nome

`loadInstitutionDetail` — detalhe institucional / ficha (P4).

### 2. Arquivo

| Papel | Caminho |
|-------|---------|
| Loader | `web/src/server/read-models/institutionDetail.ts` |
| Tipos | `institutionDetailTypes.ts` |
| Query URL | `institutionDetailQuery.ts` |
| Timeline | `institutionDetailTimeline.ts` |
| Proveniência | `institutionDetailProvenance.ts` |

### 3. Objetivo

Página `/instituicoes/[id]`: cabeçalho da instituição, **linha do tempo** (processos, tramitações, atos, eventos, documentos), proveniência por item e da instituição, maps para edição inline, opções de mantenedora (formulário).

### 4. Entrada

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `instituicaoId` | `string` | UUID |
| `searchParams` | `InstitutionDetailSearchParams` | `showDeleted?`, `limit?`, `returnTo?` |
| `options.includeMantenedoraOptions` | `boolean?` | Carrega até 200 mantenedoras para select |

Parse: `parseInstitutionDetailQuery` — `showDeleted` se `showDeleted=1`; `limit` clamp **50–500** (default **200**); `returnTo` se path absoluto.

### 5. Saída

`LoadInstitutionDetailResult`:

| Status | Campos |
|--------|--------|
| `ok` | `query`, `instituicao`, `timeline`, `lookups`, `institutionProvenance`, `mantenedoraOptions` |
| `not_found` | — |
| `db_error` | — |

- **`timeline`:** inclui **tramitações**; campos `proveniencia`, `href` (download), `deletedAt`.
- **`lookups`:** `Map`s por id (processo, tramitação, ato, evento, documento) para forms/actions.
- **`mantenedoraOptions`:** vazio se `includeMantenedoraOptions` false.

Constantes exportadas: `INSTITUTION_DETAIL_*_LIMIT`, `buildInstitutionDetailReturnTo`, etc.

**UI:** exibe no máximo `INSTITUTION_DETAIL_TIMELINE_DISPLAY_LIMIT` (**200**) itens da timeline — slice na página, não no loader.

### 6. Consumidores

| Consumidor | Uso |
|------------|-----|
| `web/src/app/instituicoes/[id]/page.tsx` | Ficha institucional completa |

Mutações da ficha: `instituicaoMutationsService` (Etapa 3 S1) — fora deste documento.

### 7. Origem dos dados

| Bloco | Origem |
|-------|--------|
| Instituição + filhos | `prisma.instituicao.findFirst` + include dinâmico (`take` por coleção) |
| Proveniência | `fonteDados` + `importacaoLote` em batch (`collectProvenanceIds`) |
| Mantenedoras (opcional) | `prisma.mantenedora.findMany` (200, ativas) |

Limites de carga (por query `limit`, default 200):

| Coleção | `take` |
|---------|--------|
| Processos | `min(200, limit)` |
| Tramitações / processo | `min(200, limit)` |
| Atos, eventos, documentos | `limit` |

`showDeleted` remove filtro `deletedAt: null` nas coleções.

### 8. Paginação / limites

| Item | Limite |
|------|--------|
| Query `limit` | 50–500 (default 200) |
| Processos / tramitações carregados | `min(200, limit)` |
| Exibição timeline na UI | **200** (`TIMELINE_DISPLAY_LIMIT`) |
| Opções mantenedora | **200** |

Sem paginação de timeline — usuário pode aumentar `limit` via URL.

### 9. Ordenação

**SQL:** processos (`dataAbertura`, `createdAt` desc), tramitações (`dataMovimento` desc), atos/eventos/documentos por data desc.

**Timeline em memória:**

1. Data desc  
2. Tipo: ato → evento → processo → **tramitação** → documento  
3. `id` asc  

Diferente do relatório (sem tramitação; ordem de tipos distinta).

### 10. Observações de performance

- Include profundo: processos × tramitações pode explodir linhas retornadas (cap por `take` em cada nível).
- Proveniência: 2 queries batch após carga — não bloqueia ficha se falhar.
- Timeline montada em memória sobre subconjunto carregado — pode não refletir histórico além do `limit`.
- Paridade parcial com relatório (limites vs unbounded) — risco de divergência percebida.

### 11. Pendências

- [ ] Alinhar limites e tipos de timeline com **P1** (relatório) ou documentar diferença como intencional.
- [ ] Paginação/infinite scroll na timeline.
- [ ] Carregar proveniência sob demanda por item (lazy) em históricos grandes.
- [ ] Read model para prévias de reconciliação (`api/reconciliacao/preview/*` ainda com Prisma na rota).

---

## 7. Testes unitários (sem banco)

| Módulo | Arquivo de teste |
|--------|------------------|
| Relatório timeline | `institutionalReportTimeline.test.ts` |
| Lista query | `institutionListQuery.test.ts` |
| Busca query / abas | `globalSearchQuery.test.ts` |
| Detalhe query URL | `institutionDetailQuery.test.ts` |
| Detalhe timeline | `institutionDetailTimeline.test.ts` |

Loaders integrais (`load*`) não têm testes com Prisma mockados nesta fase.

---

## 8. Leituras ainda fora dos read models

Consultas relevantes que **permanecem** em páginas/rotas (candidatas a extração futura, sem iniciar agora):

| Área | Local | Observação |
|------|-------|------------|
| Listagem de jobs de auditoria | `auditoria/exports/page.tsx` | `prisma.auditoriaExportJob.findMany` |
| Relatório API instituições | `api/relatorios/instituicoes/route.ts` | `prisma.instituicao.findMany` |
| Prévia reconciliação | `api/reconciliacao/preview/*` | Leitura + regras de colisão |
| Mantenedoras, importações, admin | várias páginas | CRUD/listagens locais |
| Export auditoria síncrono | `api/auditoria/export.json`, `export.csv` | Poderia compartilhar `buildLogAuditoriaWhere` com export jobs |
| Formulário upload lote | `documentos/lote/page.tsx` | Listas para combo |

---

## 9. Pendências gerais da camada de leitura

### Documentação e governança

- [ ] Referenciar este spec em `docs/architecture.md`.
- [ ] Manter paridade entre plano (INEP, mantenedora na busca) e implementação ou ajustar o plano.

### Performance e escala

- [ ] Limitar ou paginar **P1** (relatório unbounded).
- [ ] Revisar custo de **5 counts** em toda busca (P3).
- [ ] Índices alinhados a `nomeNormalizado`, compostos `(instituicaoId, deletedAt, data*)`.
- [ ] Avaliar cache (RSC `unstable_cache` ou CDN) para relatório e listas quentes.

### Consistência entre read models

- [ ] Unificar builders de timeline/proveniência (P1 vs P4).
- [ ] Compartilhar parse de CNPJ/termos entre lista (P2) e busca (P3).
- [ ] Definir política única de “instituição ativa” (`deletedAt: null`) em todos os loaders.

### Evolução funcional (Etapa 4+)

- [ ] Busca textual full-text (PostgreSQL `tsvector` ou serviço dedicado) — adiada no plano.
- [ ] Read models para módulos administrativos e ingestão (somente leitura).
- [ ] Testes de integração dos loaders contra banco de teste.

---

## 10. Referências cruzadas

| Documento | Relação |
|-----------|---------|
| `docs/docs_database_first_transition_plan.md` | Etapa 2 (prioridades P1–P4) |
| `docs/mutation-services-spec.md` | Escrita da ficha, reconciliação, documentos, export jobs |
| `docs/domain-model.md` | Entidades e relacionamentos |
| `docs/data-dictionary.md` | Campos e enums |
| `docs/search-spec.md` | Metas de busca/desempenho (se existir) |

---

*Versão: 1.0 — consolidada a partir de `web/src/server/read-models/` após conclusão de P1–P4 da Etapa 2.*
