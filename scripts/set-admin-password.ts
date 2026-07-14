// One-off maintenance: set (rotate or provision) the admin login's password on
// the database named by DATABASE_URL in the current environment. Reuses the
// app's real `hashPassword`, so the stored pbkdf2 `salt:hash` format matches
// exactly — no lockout from a hand-rolled hash. Reads the new credentials from
// the ENVIRONMENT (never a CLI arg / committed value), so the plaintext never
// lands in shell history or the repo. Touches ONLY the admin user — no catalog
// side effects — and is idempotent.
//
//   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='<from your password manager>' \
//     DATABASE_URL='<target, e.g. prod>' npm run set-admin-password
//
// After running: log in with the new password and confirm the old one fails.
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { readAdminCredentials } from "../src/lib/admin-credentials";

async function main(): Promise<void> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const creds = readAdminCredentials(process.env);
  if (!creds) {
    console.error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD to the desired admin login, e.g.\n" +
        "  ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='…' \\\n" +
        "    DATABASE_URL='<target>' npm run set-admin-password",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — point it at the target database.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = hashPassword(creds.password);
    // Deliberate rotation: unlike the seed, we DO overwrite the password here.
    const user = await prisma.user.upsert({
      where: { email: creds.email },
      update: { passwordHash, role: "ADMIN" },
      create: { email: creds.email, passwordHash, role: "ADMIN" },
      select: { email: true },
    });
    console.log(
      `Admin password set for ${user.email}. Any previous credentials no longer work.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
