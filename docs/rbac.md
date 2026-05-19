# rbac.md

## Objetivo
Definir perfis e permissões mínimas do MVP (RBAC) para garantir segurança, rastreabilidade e operação simples.

## Perfis (MVP)
- **ADMIN**
  - Gerencia usuários/perfis
  - Acessa auditoria e configurações
  - Pode importar e editar dados
- **OPERADOR_DADOS**
  - Executa importações por lote
  - Resolve pendências de reconciliação
  - Pode editar cadastros canônicos
- **ANALISTA**
  - Busca, visualiza e gera relatórios
  - Pode criar/editar registros (opcional no MVP; se habilitado, restrito a alguns campos)
- **LEITOR**
  - Somente leitura (busca + visualização)

## Ações (escopo de autorização)
### Administração
- `users:read`
- `users:write`
- `profiles:read`
- `profiles:write`
- `audit:read`

### Cadastros (canônico)
- `maintainers:read` / `maintainers:write`
- `institutions:read` / `institutions:write`
- `processes:read` / `processes:write`
- `regulatory:read` / `regulatory:write` (atos/eventos/tramitações)
- `documents:read` / `documents:write`

### Ingestão
- `imports:read`
- `imports:run`
- `imports:reconcile`

### Relatórios
- `reports:generate`

## Matriz de permissões (recomendada)
- **ADMIN**
  - Todas as permissões
- **OPERADOR_DADOS**
  - `audit:read` (opcional)
  - `imports:*`
  - `*:read` (tudo leitura)
  - `maintainers:write`, `institutions:write`, `processes:write`, `regulatory:write`, `documents:write`
- **ANALISTA**
  - `*:read` (tudo leitura)
  - `reports:generate`
  - Escrita opcional (se necessário): `documents:write` e `regulatory:write` (avaliar)
- **LEITOR**
  - `*:read` (tudo leitura)

## Regras complementares (MVP)
- Operações de escrita devem registrar auditoria (independente do perfil).
- Importação por lote é exclusiva de `OPERADOR_DADOS` e `ADMIN`.
- Visualização de auditoria é exclusiva de `ADMIN` (e opcionalmente `OPERADOR_DADOS`).
