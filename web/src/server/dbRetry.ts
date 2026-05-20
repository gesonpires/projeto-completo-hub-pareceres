import { resetPrismaClient } from "@/server/db";

export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "P1017" || msg.includes("Server has closed the connection")) {
      await resetPrismaClient();
      return await fn();
    }
    throw e;
  }
}

