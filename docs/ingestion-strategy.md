# ingestion-strategy.md

## Objetivo
Definir a estratégia de ingestão, saneamento, reconciliação e carga dos dados históricos do MVP.

## Fontes prioritárias
- Arqword
- Excel
- Google Sheets

## Estratégia por fases
- Inventário
- Mapeamento de colunas
- Normalização
- Reconciliação
- Persistência

## Ingestão mínima viável (MIV) — definição operacional
No MVP, a ingestão deve funcionar de ponta a ponta para **um formato inicial** (recomendado: **XLSX**; alternativa: CSV), com:
- Upload de arquivo e criação de `importacao_lote`
- Preview (amostra) e validação (por linha/campo)
- Relatório de inconsistências (erros e avisos)
- Persistência com proveniência (`fonte_dados`, `importacao_lote`)
- Idempotência por lote (reprocessar o mesmo arquivo não gera duplicações indevidas)

## Inventário (pré‑ingestão)
- Mapear onde vivem dados por fonte (planilhas, extrações do Arqword, etc.)
- Definir layouts/colunas “candidatas” por entidade: instituição, mantenedora, processo, atos/eventos, documentos
- Classificar qualidade: presença de CNPJ, datas, códigos internos, inconsistências comuns

## Mapeamento de colunas (contrato do arquivo)
Cada layout aceito deve documentar:
- Nome da coluna → campo canônico
- Tipo esperado (texto, data, número)
- Obrigatoriedade (erro se ausente vs aviso)
- Regras de normalização
- Regras de validação (ex.: CNPJ inválido)

## Normalização (saneamento)
### Identificadores
- **CNPJ**: armazenar sem máscara (somente dígitos); manter versão formatada apenas para exibição.
- **Nome**: normalização para comparação (trim, uppercase, remover múltiplos espaços; opcional: remover acentos para chave de busca).

### Datas
- Parse robusto (dd/mm/aaaa e variantes)
- Persistir em timezone consistente (preferir UTC em `datetime`; `date` quando não há hora)

### Campos textuais
- Remover caracteres invisíveis
- Padronizar separadores e enumerações (ex.: “Sim/Não”, “Ativo/Inativo”)

## Reconciliação (dedupe e match)
O objetivo é **consolidar o cadastro canônico** sem perder o rastro da origem.

### Chaves candidatas (por entidade)
- **Mantenedora**: CNPJ (quando existe) → match exato.
- **Instituição**: CNPJ (quando existe) → match exato; caso ausente, match por (nome normalizado + município) com “confiança”.
- **Processo**: número/código do processo + instituição (quando existe); caso contrário, heurística por metadados.

### Estratégia de match (em camadas)
1. **Exato**: CNPJ / código / combinação determinística.
2. **Provável**: nome normalizado semelhante + município + outros sinais (ex.: endereço parcial).
3. **Pendente**: não casar automaticamente; criar pendência para revisão humana.

### Saídas da reconciliação
- **Matched**: atualizar/associar ao registro canônico existente.
- **New**: criar registro canônico.
- **Conflict/Pendente**: registrar item para revisão antes de publicar.

## Persistência e proveniência (lineage)
- Sempre criar `importacao_lote` e registrar:
  - arquivo (metadados), fonte, usuário, timestamps, contagens (lidas/validadas/importadas/rejeitadas)
- Para registros importados, registrar:
  - `fonte_dados_id`, `importacao_lote_id`
  - referência à linha/origem quando viável (ex.: `source_row`)
- Manter auditoria para operações manuais e para decisões de reconciliação.

## Tratamento de erros e relatórios
### Categorias
- **Erro (bloqueia linha)**: campo obrigatório ausente, CNPJ inválido, data impossível.
- **Aviso (não bloqueia)**: nome com baixa qualidade, município não reconhecido, possíveis duplicatas.

### Relatório por lote
- Resumo com contagens
- Lista de erros/avisos por linha e por tipo
- Exportável (CSV/JSON) para inspeção

## Controles de qualidade e idempotência
- Importação deve ser transacional por “unidade” (por exemplo: por lote ou por bloco)
- Reprocessamento do mesmo arquivo:
  - detectar “mesmo lote” (hash do arquivo + fonte + timestamp) e evitar duplicação
  - permitir modo “reexecutar” que limpa apenas staging do lote, não dados canônicos já conciliados sem confirmação
