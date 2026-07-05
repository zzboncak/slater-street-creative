const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

// Mirror of src/lib/auth.ts hashing: pbkdf2 with a per-user random salt,
// stored as `salt:hash`. Kept in sync manually (seed.js can't import the TS lib).
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const computed = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, "sha256")
    .toString("hex");
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function main() {
  const email = "admin"; // store 'admin' as email/username
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { email, passwordHash: hashPassword("admin"), role: "ADMIN" },
    });
    console.log("Seeded admin user: 'admin' / 'admin'");
  } else {
    if (
      existing.role !== "ADMIN" ||
      !verifyPassword("admin", existing.passwordHash)
    ) {
      await prisma.user.update({
        where: { email },
        data: { role: "ADMIN", passwordHash: hashPassword("admin") },
      });
      console.log(
        "Updated existing admin to role ADMIN with default password.",
      );
    } else {
      console.log("Admin user already exists");
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
