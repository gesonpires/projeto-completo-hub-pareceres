import { getIntegrationDatabaseUrl } from "./integrationEnv";
import { resetPrismaClient } from "@/server/db";

const url = getIntegrationDatabaseUrl();
if (url) {
  process.env.DATABASE_URL = url;
  void resetPrismaClient();
}
