const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function hashPassword(password) {
  return crypto
    .pbkdf2Sync(password, JWT_SECRET, 100_000, 32, "sha256")
    .toString("hex");
}

async function main() {
  const email = "admin"; // using 'email' column to store username 'admin'
  const passwordHash = hashPassword("admin");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({ data: { email, passwordHash } });
    console.log("Seeded admin user: 'admin' / 'admin'");
  } else {
    console.log("Admin user already exists");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
