# search-spec.md

## Objetivo
Definir a especificação de busca do MVP (filtros, ordenação, full‑text, índices e metas mínimas de performance).

## Entidades pesquisáveis (MVP)
- **Instituições** (principal)
- **Processos** (secundário, sempre navegando para instituição)

## Campos e filtros (Instituições)
### Texto livre
- `q`: busca por nome e variações (nome normalizado); opcionalmente CNPJ digitado com máscara.

### Filtros
- `cnpj` (exato; normalizado)
- `municipio`
- `uf`
- `situacao` (se adotado no MVP)
- `tem_processos` (boolean; opcional)
- `periodo_eventos` (data início/fim para atos/eventos)

### Ordenação
- Padrão: `nome` ascendente
- Alternativas: `mais_recentes` (por último ato/evento), `mais_processos` (contagem)

## Campos e filtros (Processos)
### Texto livre
- `q`: número/código do processo (match parcial) e assunto (se indexado)

### Filtros
- `instituicao_id`
- `status`
- `tipo`
- `ano`
- `periodo_abertura` (início/fim)

### Ordenação
- Padrão: mais recentes (data de abertura desc; fallback `created_at`)

## Estratégia de busca (implementação)
### Base (sempre)
- Consultas SQL/Prisma com:
  - paginação (limit/offset ou cursor)
  - ordenação determinística
  - filtros com índices

### Full‑text (quando necessário)
Usar Postgres `tsvector` para:
- `instituicoes.nome` (ou `nome_normalizado`)
- Opcional: `documentos.titulo` e `atos_autorizativos.ementa` (provavelmente fora do MVP se não houver extração textual)

## Índices mínimos recomendados (MVP)
- `instituicoes(cnpj)` (índice; único quando preenchido)
- `instituicoes(nome_normalizado)` (índice)
- `instituicoes(municipio)` (índice)
- `processos(instituicao_id, status)` (índice composto)
- `processos(numero)` e `processos(ano)`
- `atos_autorizativos(instituicao_id, data_ato)` (para ordenar “mais recentes”)
- `eventos_regulatorios(instituicao_id, data_evento)` (para timeline)

## Metas mínimas de performance (MVP)
Em ambiente interno com volume “MVP”:
- **Busca de instituições**: p95 < 800ms para consultas típicas com filtros e paginação
- **Detalhe institucional consolidado**: p95 < 1200ms (com timeline paginável se necessário)

## Considerações de UX
- Sempre mostrar contagem aproximada/total quando viável
- Paginação com estado preservado ao voltar do detalhe
- Mensagens claras para “0 resultados” e “filtros restritivos”
