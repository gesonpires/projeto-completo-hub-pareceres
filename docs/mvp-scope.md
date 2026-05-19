# mvp-scope.md

## Objetivo
Congelar o **escopo do MVP**, critérios de aceite e limites (in/out) para orientar execução e evitar creep.

## Escopo (in)
### Cadastro e consolidação
- Mantenedora (cadastro canônico) com CNPJ quando disponível
- Instituição (cadastro canônico) com vínculo opcional à mantenedora
- Processo (mínimo) vinculado à instituição
- Atos autorizativos e eventos regulatórios vinculados à instituição (e opcionalmente ao processo)
- Documentos (metadados + upload de anexo no storage local)

### Busca e visualização
- Busca de instituições por nome/CNPJ + filtros (município, status, período, tipo)
- Detalhe institucional com **linha do tempo** consolidada (processos + atos + eventos + documentos)

### Ingestão mínima viável (MIV)
- Importação por lote de 1 formato inicial (XLSX recomendado)
- Preview, validação, normalização, dedupe básico e pendências
- Proveniência por registro (fonte + lote) e relatório de inconsistências

### Relatórios e auditoria
- Relatório institucional em HTML e exportação PDF
- Logs de auditoria para alterações relevantes e geração de relatório

## Fora do escopo (out)
- Integração ao vivo/bidirecional com Arqword (apenas ingestão por lote no MVP)
- OCR/extração automática de conteúdo de PDF e classificação inteligente
- Workflow completo de tramitação (tarefas, filas, assinatura digital, notificações)
- Permissões avançadas por comissão/tema além do RBAC básico

## Critérios de aceite (MVP)
- **Autenticação/RBAC**: somente usuários autenticados acessam; permissões bloqueiam ações não autorizadas (ver `docs/rbac.md`).
- **Busca**: pesquisar por nome/CNPJ retorna lista paginada; filtros funcionam; ordenação consistente.
- **Detalhe consolidado**: página da instituição exibe dados canônicos + histórico cronológico (processos/atos/eventos/documentos).
- **Relatório**: gerar HTML e exportar PDF com mesmo conteúdo; ação fica auditada.
- **Auditoria**: CRUD relevante grava auditoria com usuário e timestamps.
- **Proveniência**: itens importados exibem fonte/lote; relatório por lote lista erros/avisos.

## Requisitos não‑funcionais mínimos
- **Segurança**: RBAC, auditoria, proteção de rotas.
- **Confiabilidade**: importação idempotente por lote e tratamento robusto de erros.
- **Performance**: metas e índices de busca definidos em `docs/search-spec.md`.

## Dependências e decisões abertas
- Mecanismo de autenticação (SSO/interno) — implementar o necessário para “usuário autenticado” no MVP.
- Layout exato do primeiro arquivo de importação (XLSX/CSV) — deve ser documentado junto ao primeiro parser.
