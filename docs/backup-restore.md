# Backup/Restore mínimo (MVP)

Este documento descreve um procedimento **operacional e reprodutível** para:

- **Backup do banco** PostgreSQL do projeto (`hub_pareceres`)
- **Backup do storage local** de anexos (`web/storage/`)
- **Restore** de ambos em ambiente local (dev)

> Importante: o restore normalmente envolve **apagar** o banco alvo. Não execute em produção sem um procedimento formal.

## O que precisa ser preservado

- **Banco**: PostgreSQL (schema `public`) com todas as tabelas do MVP.
- **Storage local**: pasta `web/storage/` (arquivos referenciados por `Documento.storagePath`).

## Onde ficam os anexos (storage local)

Os uploads são gravados em:

- `web/storage/documentos/<instituicaoId>/<documentoId>/<arquivo>`

Logo, o backup do storage é simplesmente uma cópia da pasta `web/storage/`.

## Backup (Windows / PowerShell) — Postgres local (serviço)

Pré-requisitos:
- `pg_dump` e `pg_restore` no PATH (instalação do PostgreSQL no Windows costuma incluir).
- Acesso ao banco conforme o seu `DATABASE_URL` em `web/.env`.

### 1) Backup do banco (formato custom)

No PowerShell, dentro da pasta `web/`:

```powershell
$env:PGHOST="localhost"
$env:PGPORT="5432"
$env:PGDATABASE="hub_pareceres"
$env:PGUSER="hub_app"
$env:PGPASSWORD="9623"

mkdir -Force ..\backups | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$file = "..\backups\hub_pareceres-$ts.dump"

pg_dump -Fc -f $file
Write-Host "Backup do banco criado em $file"
```

### 2) Backup do storage

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$src = ".\storage"
$dst = "..\backups\storage-$ts"

if (Test-Path $src) {
  Copy-Item -Recurse -Force $src $dst
  Write-Host "Backup do storage criado em $dst"
} else {
  Write-Host "Sem storage ainda (pasta $src não existe)."
}
```

## Restore (Windows / PowerShell) — Postgres local (serviço)

> Atenção: os comandos abaixo **apagam o banco** alvo antes de restaurar.

### 1) Dropar e recriar o banco

```powershell
$env:PGHOST="localhost"
$env:PGPORT="5432"
$env:PGUSER="postgres"
$env:PGPASSWORD="SUA_SENHA_DO_POSTGRES"

psql -d postgres -c "DROP DATABASE IF EXISTS hub_pareceres;"
psql -d postgres -c "CREATE DATABASE hub_pareceres;"
```

Se você usa um usuário dedicado (ex.: `hub_app`), garanta as permissões:

```powershell
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE hub_pareceres TO hub_app;"
```

### 2) Restaurar o dump

```powershell
$env:PGHOST="localhost"
$env:PGPORT="5432"
$env:PGDATABASE="hub_pareceres"
$env:PGUSER="hub_app"
$env:PGPASSWORD="9623"

$file = "..\backups\hub_pareceres-YYYYMMDD-HHMMSS.dump"
pg_restore -Fc --clean --if-exists --no-owner --no-privileges -d $env:PGDATABASE $file
Write-Host "Restore do banco concluído."
```

### 3) Restaurar o storage

```powershell
$src = "..\backups\storage-YYYYMMDD-HHMMSS"
$dst = ".\storage"

if (Test-Path $src) {
  Remove-Item -Recurse -Force $dst -ErrorAction SilentlyContinue
  Copy-Item -Recurse -Force $src $dst
  Write-Host "Restore do storage concluído."
} else {
  Write-Host "Pasta de storage do backup não encontrada: $src"
}
```

### 4) Pós-restore

- Rode o seed para recriar usuário admin e tipos mínimos:

```powershell
cd .\web
npm run seed
```

- Suba o app (`npm run dev`) e valide:
  - login
  - `/instituicoes`
  - download de um documento (se existir)

## Alternativa: Postgres via Docker (`web/docker-compose.yml`)

Se estiver usando o Postgres em container:

- O backup/restore é o mesmo conceito (pg_dump/pg_restore), mas você pode executar dentro do container:

```powershell
docker exec -t hub-pareceres-db pg_dump -U postgres -Fc -f /tmp/hub_pareceres.dump hub_pareceres
docker cp hub-pareceres-db:/tmp/hub_pareceres.dump ..\backups\hub_pareceres.dump
```

E para restore (exemplo simplificado):

```powershell
docker cp ..\backups\hub_pareceres.dump hub-pareceres-db:/tmp/hub_parecerceres.dump
docker exec -t hub-pareceres-db pg_restore -U postgres -d hub_pareceres --clean --if-exists /tmp/hub_parecerceres.dump
```

> Ajuste usuário/senha conforme `web/docker-compose.yml`.

