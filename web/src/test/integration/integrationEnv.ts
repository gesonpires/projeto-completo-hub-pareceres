/** URL do Postgres de teste; obrigatória para rodar `npm run test:integration`. */
export function getIntegrationDatabaseUrl(): string | undefined {
  const url = process.env.INTEGRATION_DATABASE_URL?.trim();
  return url || undefined;
}

export function isIntegrationEnabled(): boolean {
  return Boolean(getIntegrationDatabaseUrl());
}
