# data-dictionary.md

## Objetivo
Definir o dicionário de dados inicial do MVP.

## Convenções gerais
Tipos lógicos: uuid, string, text, boolean, date, datetime, integer, json, enum.

## Convenções de modelagem
- **PK**: `id` (uuid)
- **Auditoria básica** (quando aplicável): `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at` (soft delete)
- **Proveniência (quando importado)**: `fonte_dados_id`, `importacao_lote_id`, `source_ref` (ex.: linha/aba)
- **Normalização**:
  - CNPJ armazenado sem máscara (somente dígitos) em campos `*_cnpj`
  - Campos `nome_normalizado` para busca/dedupe (uppercase, sem espaços duplicados; opcional sem acentos)

## Tabelas principais
- perfis
- usuarios
- comissoes
- mantenedoras
- instituicoes
- processos
- tipos_documento
- documentos
- atos_autorizativos
- eventos_regulatorios
- tramitacoes
- fontes_dados
- importacoes_lote
- logs_auditoria

## Dicionário (versão MVP)
> Observação: esta é uma especificação mínima para orientar schema/Prisma. Campos podem ser refinados durante a implementação, mantendo as convenções.

### `perfis`
- `id` uuid (PK)
- `nome` string (único) — enum lógico (ex.: ADMIN, OPERADOR_DADOS, ANALISTA, LEITOR)
- `descricao` text

### `usuarios`
- `id` uuid (PK)
- `nome` string
- `email` string (único)
- `perfil_id` uuid (FK → perfis)
- `ativo` boolean
- Auditoria básica

### `comissoes` (opcional no MVP, mas previsto)
- `id` uuid (PK)
- `nome` string (único)
- `descricao` text
- Auditoria básica

### `mantenedoras`
- `id` uuid (PK)
- `razao_social` string
- `nome_fantasia` string (opcional)
- `cnpj` string (único quando presente; normalizado)
- `nome_normalizado` string (índice)
- `observacoes` text (opcional)
- Proveniência (quando importada) + Auditoria básica

### `instituicoes`
- `id` uuid (PK)
- `nome` string
- `nome_normalizado` string (índice)
- `cnpj` string (opcional; índice; único quando presente)
- `mantenedora_id` uuid (FK → mantenedoras, opcional)
- `municipio` string (opcional; índice)
- `uf` string (opcional)
- `situacao` enum (ex.: ATIVA, INATIVA, EM_ANALISE) (opcional no MVP)
- `endereco` text (opcional)
- Proveniência (quando importada) + Auditoria básica

### `processos`
- `id` uuid (PK)
- `instituicao_id` uuid (FK → instituicoes)
- `numero` string (opcional; índice)
- `ano` integer (opcional; índice)
- `tipo` enum (ex.: CREDENCIAMENTO, AUTORIZACAO, RENOVACAO, OUTRO) (opcional no MVP)
- `status` enum (ex.: ABERTO, EM_TRAMITACAO, CONCLUIDO, ARQUIVADO) (índice)
- `data_abertura` date (opcional)
- `data_conclusao` date (opcional)
- `assunto` text (opcional)
- Proveniência (quando importada) + Auditoria básica

### `tipos_documento`
- `id` uuid (PK)
- `codigo` string (único) (ex.: OFICIO, PARECER, RESOLUCAO, OUTRO)
- `nome` string

### `documentos`
- `id` uuid (PK)
- `tipo_documento_id` uuid (FK → tipos_documento)
- `instituicao_id` uuid (FK → instituicoes, opcional)
- `processo_id` uuid (FK → processos, opcional)
- `titulo` string
- `data_documento` date (opcional; índice)
- `arquivo_nome` string (opcional)
- `arquivo_mime` string (opcional)
- `arquivo_tamanho` integer (opcional)
- `storage_path` string (opcional) — path/URI no storage local
- `texto_extraido` text (opcional; fora do MVP se não houver OCR)
- Proveniência (quando importada) + Auditoria básica

### `atos_autorizativos`
- `id` uuid (PK)
- `instituicao_id` uuid (FK → instituicoes)
- `processo_id` uuid (FK → processos, opcional)
- `tipo` enum (ex.: PARECER, RESOLUCAO, PORTARIA, OUTRO)
- `numero` string (opcional)
- `data_ato` date (índice)
- `ementa` text (opcional)
- `descricao` text (opcional)
- Proveniência (quando importada) + Auditoria básica

### `eventos_regulatorios`
- `id` uuid (PK)
- `instituicao_id` uuid (FK → instituicoes)
- `processo_id` uuid (FK → processos, opcional)
- `tipo` enum (ex.: PROTOCOLO, DILIGENCIA, REUNIAO, DECISAO, OUTRO)
- `data_evento` date (índice)
- `descricao` text
- Proveniência (quando importada) + Auditoria básica

### `tramitacoes`
- `id` uuid (PK)
- `processo_id` uuid (FK → processos)
- `data_movimento` date (índice)
- `de_setor` string (opcional)
- `para_setor` string (opcional)
- `status` enum (ex.: ENCAMINHADO, RECEBIDO, DEVOLVIDO, OUTRO) (opcional)
- `observacao` text (opcional)
- Proveniência (quando importada) + Auditoria básica

### `fontes_dados`
- `id` uuid (PK)
- `nome` string (único) — ex.: ARQWORD, EXCEL_HISTORICO, GSHEET_X
- `tipo` enum (ex.: ARQWORD, XLSX, CSV, GSHEET, OUTRO)
- `descricao` text (opcional)
- Auditoria básica

### `importacoes_lote`
- `id` uuid (PK)
- `fonte_dados_id` uuid (FK → fontes_dados)
- `arquivo_nome` string
- `arquivo_hash` string (opcional) — para idempotência
- `status` enum (ex.: CRIADO, VALIDADO, IMPORTADO, COM_PENDENCIAS, FALHOU)
- `contagem_lidas` integer
- `contagem_importadas` integer
- `contagem_rejeitadas` integer
- `relatorio_erros` json (opcional)
- `criado_por` uuid (FK → usuarios)
- `created_at` datetime

### `logs_auditoria`
- `id` uuid (PK)
- `entidade` string (ex.: instituicoes, processos, documentos)
- `entidade_id` uuid
- `acao` enum (ex.: CREATE, UPDATE, DELETE, RESTORE)
- `actor_user_id` uuid (FK → usuarios)
- `timestamp` datetime
- `antes` json (opcional)
- `depois` json (opcional)
- `metadata` json (opcional) — request id, motivo, origem, etc.

## Índices recomendados (MVP)
- `instituicoes(nome_normalizado)`, `instituicoes(cnpj)`, `instituicoes(municipio)`
- `mantenedoras(cnpj)`, `mantenedoras(nome_normalizado)`
- `processos(instituicao_id, status)`, `processos(numero)`, `processos(ano)`
- `atos_autorizativos(instituicao_id, data_ato)`
- `eventos_regulatorios(instituicao_id, data_evento)`
- `documentos(instituicao_id, data_documento)`, `documentos(processo_id, data_documento)`
