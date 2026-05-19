# Plano do MVP — Hub de Pareceres (CEE‑SC)

## Projeto
Sistema Integrado de Apoio às Rotinas do CEE‑SC (uso interno).

## Visão geral
Sistema web para apoio técnico‑administrativo do CEE‑SC, com foco inicial em **busca institucional inteligente** e **consolidação do histórico regulatório**. O núcleo do MVP é **Instituição + Processo + Histórico Regulatório** com rastreabilidade de origem.

## Problema central
Hoje os dados estão dispersos em Arqword, planilhas Excel e Google Sheets, gerando demora, retrabalho, risco de erro e dependência de conhecimento tácito.

## Objetivo do MVP (o que entregar)
- **Cadastro e consolidação** de instituições e mantenedoras (cadastro canônico).
- **Vínculo de processos** às instituições, com campos mínimos e status.
- **Histórico regulatório** consolidado (atos/eventos) com origem por registro.
- **Busca** com filtros e texto livre (full‑text quando aplicável).
- **Relatório institucional** (visualização e exportação PDF) com histórico consolidado.
- **Trilha de auditoria** (quem/quando/o quê) e **proveniência** (fonte/lote).
- **Base para pré‑preenchimento** de novos processos (a partir do cadastro canônico).

## Escopo do MVP (in / out)
### Dentro do MVP (in)
- Autenticação e perfis básicos (RBAC) para acesso interno.
- CRUD mínimo: mantenedora, instituição, processo, documento (metadados), ato/evento, tramitação (mínimo).
- Importação por lote de **um formato inicial** (ex.: XLSX/CSV) com preview, validação e relatório de inconsistências.
- Busca com filtros principais (nome, CNPJ, município, situação/status, tipo de ato/evento, período).
- Linha do tempo institucional consolidada.

### Fora do MVP (out / não‑fazer agora)
- Integração “ao vivo” bidirecional com Arqword (somente ingestão controlada por lote no MVP).
- OCR/extração automática de PDFs, classificação inteligente e IA generativa.
- Workflow completo de tramitação, assinatura digital, notificações e automações avançadas.
- Permissões granulares por comissão/assunto além do RBAC básico.

## Usuários e fluxos principais
- **Técnico/Analista**: pesquisar instituição → consultar histórico → emitir relatório.
- **Operador de dados**: importar lote → revisar inconsistências → reconciliar duplicatas → publicar dados canônicos.
- **Admin**: gerenciar usuários/perfis → configurar fontes → auditar alterações.

## Critérios de aceite (definição de pronto do MVP)
- **Busca**: localizar instituição por nome ou CNPJ e retornar resultados paginados com filtros aplicáveis.
- **Detalhe consolidado**: abrir uma instituição e ver linha do tempo (processos + atos/eventos + documentos) ordenada e consistente.
- **Relatório**: gerar relatório institucional (HTML) e exportar PDF com conteúdo equivalente.
- **Auditoria**: qualquer criação/edição/exclusão lógica relevante registra usuário, timestamp, entidade, antes/depois (ou diff).
- **Proveniência**: registros importados exibem fonte e lote; alterações manuais preservam histórico de auditoria.
- **Ingestão mínima**: importar 1 lote com validação; itens inválidos são reportados e não quebram o sistema.

## Métricas de sucesso (MVP)
- Reduzir tempo médio de localizar histórico institucional consolidado.
- Reduzir retrabalho e duplicidade (instituições/mantenedoras duplicadas).
- Aumentar cobertura de processos vinculados a instituições (cadastro consistente).

## Riscos e mitigação
- **Dados inconsistentes/duplicados**: reconciliação em etapas (exato → provável → manual), trilha de decisão e “pendências”.
- **Chaves ausentes (CNPJ etc.)**: estratégia de identificação alternativa (nome normalizado + município) e marcação de confiabilidade.
- **Adoção**: fluxo simples de busca/relatório no início; importação incremental.

## Requisitos não‑funcionais mínimos
- **Segurança**: autenticação, RBAC, logs de auditoria e segregação de acesso básico.
- **LGPD**: minimização de dados pessoais; retenção e backup definidos; acesso rastreável.
- **Confiabilidade**: migrações versionadas, importação idempotente por lote, backup periódico.
- **Performance**: busca e detalhe com paginação; índices adequados; metas de latência definidas em `docs/search-spec.md`.

## Documentos de suporte
- `docs/mvp-scope.md` (escopo e aceite)
- `docs/architecture.md` (arquitetura e decisões)
- `docs/domain-model.md` (modelo de domínio)
- `docs/data-dictionary.md` (dicionário de dados)
- `docs/ingestion-strategy.md` (ingestão e reconciliação)
- `docs/search-spec.md` (busca e performance)
- `docs/rbac.md` (perfis e permissões)
- `docs/mvp-backlog.md` (backlog acionável)
