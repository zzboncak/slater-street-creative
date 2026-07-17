// Apply pending Prisma migrations at deploy time, but ONLY on Vercel production
// builds (SSC-33). Preview builds and local `npm run build` skip it — previews
// share the production DATABASE_URL, so running `migrate deploy` there would push
// migrations to prod before a PR is even merged. Vercel sets VERCEL_ENV to
// "production" | "preview" | "development"; it's unset locally.
//
// Trade-off: migrations run in the build step and are forward-only — a build
// that fails AFTER this step leaves the prod schema ahead of the deployed code.
// That's safe for our additive migrations (new columns/tables), which older code
// simply ignores. Revisit if a destructive migration is ever needed.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env === "production") {
  console.log("[deploy] VERCEL_ENV=production → running prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(
    `[deploy] skipping prisma migrate deploy (VERCEL_ENV=${env ?? "unset"})`,
  );
}
