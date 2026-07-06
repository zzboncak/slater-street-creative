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
  //
  // Images are null for now (graceful "Photo coming soon" placeholder in the UI)
  // until real product photography is uploaded via Cloudflare Images.
  // priceCents is a uniform $15.00 placeholder pending real per-candle pricing.
  const PLACEHOLDER_PRICE_CENTS = 1500;
  const DEFAULT_STOCK = 25;
  const catalog = [
    {
      id: "the-garden",
      name: "The Garden",
      scentProfile: ["tomato leaf", "fresh basil", "cucumber"],
    },
    {
      id: "the-meadow",
      name: "The Meadow",
      scentProfile: ["cut grass", "fresh water"],
    },
    {
      id: "the-patio",
      name: "The Patio",
      scentProfile: ["whiskey", "garden mint"],
    },
    {
      id: "the-seaside",
      name: "The Seaside",
      scentProfile: ["sea minerals", "ozone", "coconut water"],
    },
    {
      id: "the-harbor",
      name: "The Harbor",
      scentProfile: ["dry gin", "cypress", "fresh water"],
    },
    {
      id: "the-grove",
      name: "The Grove",
      scentProfile: ["oranges", "lemon peel", "agave"],
    },
    {
      id: "the-treehouse",
      name: "The Treehouse",
      scentProfile: ["lemon verbena", "smoked oud"],
    },
    {
      id: "the-lake",
      name: "The Lake",
      scentProfile: ["fresh pine", "rain water"],
    },
    {
      id: "the-fireside",
      name: "The Fireside",
      scentProfile: ["smoked cedar", "amber", "vanilla"],
    },
    {
      id: "the-woods",
      name: "The Woods",
      scentProfile: ["sandalwood", "cedar", "leather"],
    },
    {
      id: "the-library",
      name: "The Library",
      scentProfile: ["saffron", "cedarwood", "leather"],
    },
    {
      id: "the-forest",
      name: "The Forest",
      scentProfile: ["fraser fir", "amber", "cedar"],
    },
    {
      id: "the-market",
      name: "The Market",
      scentProfile: ["peppercorn", "coriander", "chamomile"],
    },
    {
      id: "the-cabin",
      name: "The Cabin",
      scentProfile: ["sandalwood", "palo santo", "cedar"],
    },
    {
      id: "the-lodge",
      name: "The Lodge",
      scentProfile: ["pine", "moss", "cypress"],
    },
    {
      id: "the-trail",
      name: "The Trail",
      scentProfile: ["fallen leaves", "palo santo", "sandalwood"],
    },
    {
      id: "the-north",
      name: "The North",
      scentProfile: ["apple", "evergreen", "cinnamon"],
    },
    {
      id: "the-hearth",
      name: "The Hearth",
      scentProfile: ["sweet tobacco", "smoked oud"],
    },
    {
      id: "the-cafe",
      name: "The Café",
      scentProfile: ["coffee", "cinnamon", "toasted caramel"],
    },
    {
      id: "the-pumpkin-patch",
      name: "The Pumpkin Patch",
      scentProfile: ["pumpkin", "clove"],
    },
    {
      id: "the-lemonade-stand",
      name: "The Lemonade Stand",
      scentProfile: ["lemon", "spearmint"],
    },
    {
      id: "the-christmas-tree",
      name: "The Christmas Tree",
      scentProfile: ["fraser fir", "white birch", "pine", "blue spruce"],
    },
    {
      id: "the-chapel",
      name: "The Chapel",
      scentProfile: ["blue spruce", "spun cotton", "oakmoss"],
    },
    {
      id: "the-haven",
      name: "The Haven",
      scentProfile: ["smoked sage", "cypress", "oakmoss", "amber"],
    },
    {
      id: "the-sunroom",
      name: "The Sunroom",
      scentProfile: ["peppercorn", "juniper", "olive leaf", "bergamot"],
    },
  ];

  // Remove the earlier placeholder candles this catalog replaces (cascade drops
  // their inventory). Safe no-op once they're gone.
  await prisma.product.deleteMany({
    where: {
      id: { in: ["classic-vanilla", "lavender-fields", "citrus-breeze"] },
    },
  });

  for (const c of catalog) {
    await prisma.product.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        priceCents: PLACEHOLDER_PRICE_CENTS,
        scentProfile: c.scentProfile,
        type: "CANDLE",
        active: true,
      },
      create: {
        id: c.id,
        name: c.name,
        priceCents: PLACEHOLDER_PRICE_CENTS,
        image: null,
        scentProfile: c.scentProfile,
        type: "CANDLE",
        active: true,
        inventory: { create: { quantity: DEFAULT_STOCK } },
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
