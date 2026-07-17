import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { readAdminCredentials } from "../src/lib/admin-credentials";
import { scentSlug } from "../src/lib/scents";

// The one seed file (run via `npm run db:seed` -> tsx). Imports the real password
// hashing from src/lib/auth so there's no duplicated crypto to keep in sync.
// Everything here is idempotent, so it's safe to re-run.

const prisma = new PrismaClient();

// Placeholder pricing/images until real values land (see SSC-6a).
const PLACEHOLDER_PRICE_CENTS = 1500; // $15.00
const DEFAULT_STOCK = 25;

// Ids these real candles replaced (from the original mock catalog).
const LEGACY_PRODUCT_IDS = [
  "classic-vanilla",
  "lavender-fields",
  "citrus-breeze",
];

const catalog: { id: string; name: string; scentProfile: string[] }[] = [
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

async function seedAdmin() {
  // Credentials come from the environment — never a shipped default. If they're
  // unset we SKIP admin creation (the catalog still seeds); set ADMIN_EMAIL +
  // ADMIN_PASSWORD to provision one. To rotate an existing admin's password use
  // `npm run set-admin-password` — the seed deliberately never touches an
  // existing admin's password, so a re-seed can't clobber a rotated one.
  const admin = readAdminCredentials(process.env);
  if (!admin) {
    console.warn(
      "[seed] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin user. " +
        "Set both to provision one.",
    );
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: admin.email },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: admin.email,
        passwordHash: hashPassword(admin.password),
        role: "ADMIN",
      },
    });
    console.log(`[seed] created admin user ${admin.email}`);
  } else if (existing.role !== "ADMIN") {
    // Ensure the row is an admin, but NEVER change its password (rotation-safe).
    await prisma.user.update({
      where: { email: admin.email },
      data: { role: "ADMIN" },
    });
    console.log(`[seed] promoted ${admin.email} to ADMIN (password unchanged)`);
  } else {
    console.log(
      `[seed] admin ${admin.email} already exists (password unchanged)`,
    );
  }
}

async function seedScents() {
  // One Scent per distinct note across the catalog, idempotent by slug. Only
  // ensures existence (update: {}), so an admin's later rename/deactivate is
  // preserved across re-seeds — same posture as the admin user.
  const notes = new Map<string, string>(); // slug -> display name (first seen)
  for (const c of catalog)
    for (const n of c.scentProfile) {
      const slug = scentSlug(n);
      if (slug && !notes.has(slug)) notes.set(slug, n);
    }
  for (const [slug, name] of notes) {
    await prisma.scent.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
  console.log(`Seeded ${notes.size} scents.`);
}

async function seedCatalog() {
  // Remove the legacy placeholder candles this catalog replaced (cascade drops
  // their inventory + scent links). Safe no-op once they're gone.
  await prisma.product.deleteMany({
    where: { id: { in: LEGACY_PRODUCT_IDS } },
  });

  for (const c of catalog) {
    await prisma.product.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        priceCents: PLACEHOLDER_PRICE_CENTS,
        type: "CANDLE",
        active: true,
      },
      create: {
        id: c.id,
        name: c.name,
        priceCents: PLACEHOLDER_PRICE_CENTS,
        image: null,
        type: "CANDLE",
        active: true,
        inventory: { create: { quantity: DEFAULT_STOCK } },
      },
    });

    // Resync this candle's scent links to the catalog (idempotent): clear, then
    // recreate in note order, referencing the Scent rows seeded above.
    const slugs = [...new Set(c.scentProfile.map(scentSlug).filter(Boolean))];
    const scentRows = await prisma.scent.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const idBySlug = new Map(scentRows.map((s) => [s.slug, s.id]));
    const links: { productId: string; scentId: string; position: number }[] =
      [];
    slugs.forEach((slug, position) => {
      const scentId = idBySlug.get(slug);
      if (scentId) links.push({ productId: c.id, scentId, position });
    });
    await prisma.productScent.deleteMany({ where: { productId: c.id } });
    await prisma.productScent.createMany({ data: links });
  }
  console.log(`Seeded ${catalog.length} products.`);
}

async function seedCoupons() {
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {
      description: "10% off your first order",
      percentOff: 10,
      active: true,
    },
    create: {
      code: "WELCOME10",
      description: "10% off your first order",
      percentOff: 10,
      active: true,
    },
  });
  console.log("Seeded coupon: WELCOME10");
}

async function main() {
  await seedAdmin();
  await seedScents();
  await seedCatalog();
  await seedCoupons();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
