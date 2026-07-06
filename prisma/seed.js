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

  // Default catalog so the store is never empty in dev. Stable slug ids keep
  // /products/<id> URLs consistent. Idempotent: re-running refreshes fields and
  // leaves existing inventory untouched.
  const catalog = [
    {
      id: "classic-vanilla",
      name: "Classic Vanilla",
      description: "A warm, comforting vanilla scent for any room.",
      priceCents: 1800,
      image:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=60",
      scentProfile: ["vanilla", "warm"],
      quantity: 25,
    },
    {
      id: "lavender-fields",
      name: "Lavender Fields",
      description: "Relaxing lavender aroma, perfect for evenings.",
      priceCents: 2000,
      image:
        "https://images.unsplash.com/photo-1503863937795-62954a3c0f05?w=1200&auto=format&fit=crop&q=60",
      scentProfile: ["lavender", "floral"],
      quantity: 25,
    },
    {
      id: "citrus-breeze",
      name: "Citrus Breeze",
      description: "Bright citrus notes to freshen your space.",
      priceCents: 1900,
      image:
        "https://images.unsplash.com/photo-1505575989282-9576e7b91f0d?w=1200&auto=format&fit=crop&q=60",
      scentProfile: ["citrus", "fresh"],
      quantity: 25,
    },
  ];

  for (const c of catalog) {
    await prisma.product.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        description: c.description,
        priceCents: c.priceCents,
        image: c.image,
        scentProfile: c.scentProfile,
        type: "CANDLE",
        active: true,
      },
      create: {
        id: c.id,
        name: c.name,
        description: c.description,
        priceCents: c.priceCents,
        image: c.image,
        scentProfile: c.scentProfile,
        type: "CANDLE",
        active: true,
        inventory: { create: { quantity: c.quantity } },
      },
    });
  }
  console.log(`Seeded ${catalog.length} products.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
