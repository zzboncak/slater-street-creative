import { PrismaClient } from "@prisma/client";

// The database is required. Fail fast with a clear message at startup rather
// than a cryptic error on the first query (or scattered DATABASE_URL guards).
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. The database is required — start it with `npm run dev:db`, or set DATABASE_URL in your environment.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
