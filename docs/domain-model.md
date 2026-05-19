# domain-model.md

## Objetivo
Definir o modelo de domínio inicial do sistema com foco em busca institucional inteligente, cadastro de processos e consolidação do histórico regulatório.

## Núcleo do domínio
1. Instituição
2. Processo
3. Histórico Regulatório

## Entidades especializadas
- AtoAutorizativo
- EventoRegulatorio
- Tramitacao
- Comissao
- Usuario
- Perfil
- LogAuditoria
- ImportacaoLote
- FonteDados

## Relações (visão MVP)
- **Mantenedora 1 ── N Instituições**
  - Uma mantenedora pode manter várias instituições.
  - Uma instituição pode ter mantenedora (opcional no MVP, mas recomendado).
- **Instituição 1 ── N Processos**
- **Instituição 1 ── N AtosAutorizativos**
- **Instituição 1 ── N EventosRegulatorios**
- **Processo 1 ── N Tramitações**
- **Instituição/Processo 1 ── N Documentos** (documentos podem estar vinculados a uma instituição e/ou a um processo)

## Conceitos-chave
### Cadastro canônico vs dados importados
- **Cadastro canônico**: representa a “melhor versão atual” da instituição/mantenedora/processo, usada para busca, relatórios e pré‑preenchimento.
- **Dados importados**: chegam por lote e podem:
  - casar com canônico (match) e complementar
  - virar novo canônico
  - virar **pendência** (conflito/duplicidade provável) para revisão
- O sistema deve **preservar proveniência** (fonte e lote) e **auditar decisões** de reconciliação.

### Histórico regulatório
Histórico regulatório é a **consolidação cronológica** de:
- processos (abertura, status, conclusão)
- atos autorizativos (parecer/resolução/portaria etc.)
- eventos regulatórios (protocolo, diligência, decisão etc.)
- tramitações (movimentos internos do processo)
- documentos associados (metadados e anexos)

## Invariantes e regras (mínimo)
- Uma **instituição** deve ter `nome` (e idealmente `nome_normalizado`).
- `cnpj` quando presente deve ser válido e normalizado (somente dígitos).
- Um **processo** deve estar vinculado a uma instituição.
- Um **ato/evento** deve estar vinculado a uma instituição (e opcionalmente a um processo).
- Auditoria é obrigatória para operações relevantes (criar/editar/remover logicamente).
- Proveniência é obrigatória para registros criados por importação.

## Estados (enums lógicos) — sugestão MVP
### Processo.status
- `ABERTO`
- `EM_TRAMITACAO`
- `CONCLUIDO`
- `ARQUIVADO`

### ImportacaoLote.status
- `CRIADO`
- `VALIDADO`
- `IMPORTADO`
- `COM_PENDENCIAS`
- `FALHOU`

## Eventos de domínio (o que auditar)
- Criar/editar instituição/mantenedora
- Vincular/desvincular processo ↔ instituição
- Criar/editar ato/evento/tramitação
- Importar lote (criar, validar, importar, publicar, marcar pendências)
- Gerar relatório institucional

## Casos de uso principais (MVP)
- **Buscar instituição** (texto + filtros) e abrir detalhe consolidado.
- **Cadastrar/editar** instituição, mantenedora e processos básicos.
- **Importar lote** (XLSX/CSV) com validação, normalização, dedupe e pendências.
- **Emitir relatório** institucional (HTML/PDF).
