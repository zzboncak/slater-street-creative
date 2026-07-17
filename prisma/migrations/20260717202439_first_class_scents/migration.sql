-- First-class Scent entity (SSC-32): Scent + ProductScent join, backfilled from
-- the existing Product.scentProfile arrays, then the array column is dropped.
-- Order matters: create tables -> backfill (reads scentProfile) -> drop column.

-- CreateTable
CREATE TABLE "Scent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductScent" (
    "productId" TEXT NOT NULL,
    "scentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProductScent_pkey" PRIMARY KEY ("productId","scentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scent_slug_key" ON "Scent"("slug");

-- CreateIndex
CREATE INDEX "ProductScent_scentId_idx" ON "ProductScent"("scentId");

-- AddForeignKey
ALTER TABLE "ProductScent" ADD CONSTRAINT "ProductScent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScent" ADD CONSTRAINT "ProductScent_scentId_fkey" FOREIGN KEY ("scentId") REFERENCES "Scent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one Scent per distinct note (deduped by slug), then a ProductScent
-- link per (product, note) with position = array ordinality (0-based). The slug
-- expression mirrors scentSlug() in src/lib/scents.ts — keep them in sync.
INSERT INTO "Scent" ("id", "name", "slug", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d.name, d.slug, true, now(), now()
FROM (
    SELECT DISTINCT ON (slug) note AS name, slug
    FROM (
        SELECT note,
               trim(both '-' from regexp_replace(lower(trim(note)), '[^a-z0-9]+', '-', 'g')) AS slug
        FROM (SELECT DISTINCT unnest("scentProfile") AS note FROM "Product") u
    ) s
    WHERE slug <> ''
    ORDER BY slug, note
) d;

INSERT INTO "ProductScent" ("productId", "scentId", "position")
SELECT p.id, sc.id, (x.ord - 1)::int
FROM "Product" p
CROSS JOIN LATERAL unnest(p."scentProfile") WITH ORDINALITY AS x(note, ord)
JOIN "Scent" sc
  ON sc.slug = trim(both '-' from regexp_replace(lower(trim(x.note)), '[^a-z0-9]+', '-', 'g'))
ON CONFLICT ("productId", "scentId") DO NOTHING;

-- Drop the denormalized array now that its data lives in the relation.
ALTER TABLE "Product" DROP COLUMN "scentProfile";
