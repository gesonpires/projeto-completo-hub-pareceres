# mvp-backlog.md

## Objetivo
Organizar o backlog técnico do MVP em formato acionável para desenvolvimento incremental no Cursor.

## Estratégia de priorização
1. fundação técnica
2. modelagem do domínio
3. ingestão mínima viável
4. busca com filtros
5. visualização consolidada
6. relatórios e auditoria
7. refinamentos

## Definition of Done (DoD) do MVP
- Migrações versionadas (Prisma) e seed mínimo quando aplicável
- Endpoints/ações com validação de entrada e autorização (RBAC)
- Auditoria para ações relevantes (create/update/delete lógico)
- Paginação e ordenação onde há listas
- Tratamento de erros (mensagens úteis + logs)
- Documentação atualizada quando houver decisão/alteração de contrato

## Épicos e histórias (acionáveis)
### Épico 1 — Fundação técnica
- **H1.1** Autenticação e sessão
  - **Aceite**: usuário autenticado acessa a aplicação; rotas protegidas exigem login.
- **H1.2** RBAC básico (perfis e permissões)
  - **Aceite**: ações de “admin”, “importar” e “editar” respeitam permissões; matriz documentada em `docs/rbac.md`.
- **H1.3** Estrutura de auditoria e logs
  - **Aceite**: ao criar/editar/remover logicamente Instituição/Processo/Ato/Evento/Documento, grava log de auditoria com usuário e timestamp.
- **H1.4** Infra de storage local para anexos
  - **Aceite**: upload salva arquivo no storage local e registra metadados em `documentos`.

### Épico 2 — Domínio (CRUD mínimo + vínculos)
- **H2.1** CRUD Mantenedora
  - **Aceite**: criar/editar/listar com validação; prevenir duplicidade por CNPJ quando informado.
- **H2.2** CRUD Instituição + vínculo com Mantenedora
  - **Aceite**: instituicão pode ter mantenedora definida; listagem com filtros (nome/CNPJ/município).
- **H2.3** CRUD Processo + vínculo com Instituição
  - **Aceite**: processo vinculado a instituição; status e campos mínimos; histórico auditável.
- **H2.4** Atos/Eventos/Tramitações (mínimo)
  - **Aceite**: registrar ato/evento com data/tipo/descrição; exibir na linha do tempo da instituição.

### Épico 3 — Ingestão mínima viável (MIV)
- **H3.1** Upload e preview de arquivo (XLSX/CSV inicial)
  - **Aceite**: usuário faz upload, vê preview e mapeamento mínimo de colunas.
- **H3.2** Validação e relatório de inconsistências por lote
  - **Aceite**: linhas inválidas não são persistidas como canônicas; relatório lista erros por linha/campo.
- **H3.3** Normalização (CNPJ, datas, nomes) e dedupe básico
  - **Aceite**: CNPJ normalizado; duplicatas exatas são detectadas; resultado do lote é reexecutável (idempotente).
- **H3.4** Reconciliação (exato → provável → pendente)
  - **Aceite**: itens “prováveis duplicatas” ficam em pendência para revisão; decisões ficam auditadas.

### Épico 4 — Busca com filtros
- **H4.1** Busca de instituições (texto + filtros + paginação)
  - **Aceite**: buscar por nome/CNPJ; filtros aplicáveis; paginação; ordenação consistente.
- **H4.2** Busca de processos vinculados
  - **Aceite**: filtrar por status, tipo e período; navegar para instituição.
- **H4.3** Índices e full‑text (quando aplicável)
  - **Aceite**: consultas principais atendem metas de latência definidas em `docs/search-spec.md`.

### Épico 5 — Visualização consolidada
- **H5.1** Tela de detalhe institucional consolidado
  - **Aceite**: mostra dados canônicos, processos, atos/eventos, documentos e timeline ordenada.
- **H5.2** Proveniência visível
  - **Aceite**: itens importados exibem fonte e lote; alterações manuais não apagam origem.

### Épico 6 — Relatórios e auditoria
- **H6.1** Template de relatório institucional (HTML)
  - **Aceite**: relatório contém cabeçalho institucional + resumo + histórico consolidado.
- **H6.2** Exportação PDF
  - **Aceite**: PDF equivalente ao HTML; geração registrada em auditoria.
- **H6.3** Tela de auditoria (admin)
  - **Aceite**: admin consulta auditoria por entidade, usuário e período.

### Épico 7 — Refinamentos
- **H7.1** Melhorias de UX (atalhos, campos obrigatórios, mensagens)
  - **Aceite**: reduzir passos nos fluxos principais; validações impedem dados ruins.
- **H7.2** Backup/restore mínimo (operacional)
  - **Aceite**: procedimento documentado para backup do banco e do storage local.
