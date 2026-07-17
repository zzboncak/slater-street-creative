-- Roles foundation (SSC-36): rename USER → CUSTOMER and add FULFILLMENT.
--
-- RENAME VALUE relabels the enum member in place, so every existing User row that
-- was 'USER' automatically reads as 'CUSTOMER', and the column's `@default` (which
-- referenced the old label) carries over to the new one — no data backfill, no
-- default rewrite needed.
--
-- ADD VALUE appends FULFILLMENT. Postgres forbids *using* a newly-added enum value
-- in the same transaction it was added, but this migration only defines it (no
-- INSERT/UPDATE references FULFILLMENT here), so a single migration is safe.
ALTER TYPE "Role" RENAME VALUE 'USER' TO 'CUSTOMER';
ALTER TYPE "Role" ADD VALUE 'FULFILLMENT';
