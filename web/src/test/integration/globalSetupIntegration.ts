import { execSync } from "node:child_process";
import { getIntegrationDatabaseUrl } from "./integrationEnv";

/** Vitest roda com cwd em `web/`. */
const webRoot = process.cwd();

export default async function globalSetupIntegration() {
  const url = getIntegrationDatabaseUrl();
  if (!url) {
    console.warn(
      "[integration] INTEGRATION_DATABASE_URL não definida — testes de integração serão ignorados (describe.skipIf).",
    );
    return;
  }

  execSync("npx prisma db push --skip-generate", {
    cwd: webRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
