import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

const candles = [
  {
    name: "The Garden",
    scentProfile: ["tomato leaf", "fresh basil", "cucumber"],
  },
  { name: "The Meadow", scentProfile: ["cut grass", "fresh water"] },
  { name: "The Patio", scentProfile: ["whiskey", "garden mint"] },
  {
    name: "The Seaside",
    scentProfile: ["sea minerals", "ozone", "coconut water"],
  },
  {
    name: "The Harbor",
    scentProfile: ["dry gin", "cypress", "fresh water"],
  },
  {
    name: "The Library",
    scentProfile: ["saffron", "cedarwood", "leather"],
  },
  {
    name: "The Grove",
    scentProfile: ["oranges", "lemon peel", "agave"],
  },
  {
    name: "The Treehouse",
    scentProfile: ["lemon verbena", "smoked oud"],
  },
  { name: "The Lake", scentProfile: ["fresh pine", "rain water"] },
  {
    name: "The Fireside",
    scentProfile: ["smoked cedar", "amber", "vanilla"],
  },
  {
    name: "The Woods",
    scentProfile: ["sandalwood", "cedar", "leather"],
  },
  {
    name: "The Forest",
    scentProfile: ["fraser fir", "amber", "cedar"],
  },
  {
    name: "The Market",
    scentProfile: ["peppercorn", "coriander", "chamomile"],
  },
  {
    name: "The Cabin",
    scentProfile: ["sandalwood", "palo santo", "cedar"],
  },
  {
    name: "The Lodge",
    scentProfile: ["pine", "moss", "cypress"],
  },
  {
    name: "The Trail",
    scentProfile: ["fallen leaves", "palo santo", "sandalwood"],
  },
  {
    name: "The North",
    scentProfile: ["apple", "evergreen", "cinnamon"],
  },
  {
    name: "The Hearth",
    scentProfile: ["sweet tobacco", "smoked oud"],
  },
];

async function main() {
  const email = "admin"; // using username in email field per current schema
  const passwordHash = hashPassword("admin");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({ data: { email, passwordHash } });
    console.log("Seeded admin user: 'admin' / 'admin'");
  } else {
    console.log("Admin user already exists");
  }

  // Seed candles
  for (const candle of candles) {
    const existingCandle = await prisma.product.findFirst({
      where: { name: candle.name },
    });
    if (!existingCandle) {
      await prisma.product.create({
        data: {
          name: candle.name,
          scentProfile: candle.scentProfile,
          type: "CANDLE",
          priceCents: 5000, // $50.00 default price
          inventory: { create: { quantity: 10 } },
        },
      });
      console.log(`Seeded candle: ${candle.name}`);
    } else {
      console.log(`Candle already exists: ${candle.name}`);
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

