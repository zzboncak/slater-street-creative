# Working Agreement & Ticket Workflow

How work flows from the Notion board into the codebase. Anyone (human or agent) should be able to read this, pick up a ticket, and ship it the same way.

> **Current mode: fully gated.** This project is early — no CI, no tests, and the active phase is security work. Every ticket gets an interactive plan approval before code is written, and the architect reviews every PR before merge. The risk-tier system below is the **graduation path**, not the current state; it activates only when its preconditions are met.

## Roles

- **Architect / decision-maker (Zack)** — owns the schema, architecture, and board; makes the design calls; approves plans; reviews and merges every PR; sets `Sequence`.
- **Dev (Claude)** — implements tickets, writes tests, keeps docs in sync, opens PRs, and self-reviews before asking for a human pass. Explains what the code does — the architect doesn't merge code he doesn't understand.

## The ticket loop

1. **Orient** — read `AGENTS.md` (canonical guide) and `CLAUDE.md`, check `AUDIT.md` for known issues, then read the ticket (Context + Acceptance criteria).
2. **Plan** — propose the approach interactively (which files, which migration, what tests, what could go wrong) and **wait for approval** before writing code. If anything in the ticket is ambiguous, raise it here.
3. **Branch** — `ssc-<ticket#>-<short-slug>` off `main` (e.g. `ssc-1-consolidate-middleware`).
4. **Implement** — the smallest change that satisfies the ticket. One ticket = one PR.
5. **Verify** — `npx tsc --noEmit` → `npm run lint` → `npm run format`, all green locally. Once SSC-9 lands, add `npm test`. Sanity-check affected pages against `npm run dev:db` when feasible.
6. **PR** — open with a description containing: the approved plan, a **plain-language explanation of what the code does and why** (non-obvious parts especially), test/verification output, and the risky or decision-y bits surfaced at the top. Link `SSC-#`. Move the ticket to **In Review**.
7. **Merge** — architect reviews and squash-merges, then the branch is deleted. The dev never merges.
8. **Board** — move the ticket to **Done**.

## Stop-and-ask — always needs the architect

Regardless of anything else, **stop and surface** (don't decide unilaterally):

- A **schema or migration design** choice with real trade-offs.
- Anything touching **auth, money, or customer PII** beyond what the ticket explicitly scopes.
- A **new dependency** (npm package, external provider like Stripe or an email service).
- Any **deviation from documented conventions** — or a place the docs don't cover.
- Anything **ambiguous** in the ticket's acceptance criteria.
- A ticket **outgrowing** its scope (~a few hundred lines of diff): split it rather than shipping a monster PR.

Decisions stay with the architect; mechanics don't.

## Conventions

- **Branch:** `ssc-<ticket#>-<short-slug>`.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **One ticket = one PR**, targeting a few hundred lines.
- **Money is integer cents** everywhere; re-price from the DB, never trust client prices.
- **Admin mutations** check for an ADMIN-role session inside the action/route itself.
- **Formatting:** Prettier owns style (`npm run format` before committing); ESLint handles correctness.
- **Docs stay in sync:** if a ticket changes the schema, conventions, or architecture, update `AGENTS.md` (and `AUDIT.md` if it closes a known issue) **in the same PR**.
- **Follow-up work** discovered mid-ticket becomes a new board ticket, not an inline fix.

## Acceptance-criteria template (every ticket)

```
## Context
One or two lines: why this ticket exists and what it unblocks. Cite AUDIT.md if applicable.

## Acceptance criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2
- [ ] Tests cover the new behavior (once SSC-9 lands)

## Notes & references
- Relevant files / AUDIT.md section
- Related tickets: SSC-#
```

## Definition of Done

Acceptance criteria met, verification green, docs updated, PR explained in plain language, reviewed and merged by the architect, branch deleted, ticket moved to Done.

## Graduation path: risk-based autonomy tiers (not yet active)

When the preconditions are met, gating shifts from "every step" to "by risk," so the dev keeps moving and the architect reviews on a cadence.

**Preconditions to activate:** CI running the full Verify suite on PRs (SSC-9), a real test base covering auth + pricing math, Phase 1 (Security Hardening) done, and the architect comfortable with the dev's patterns.

| Tier          | What's in it (by Domain + judgment)                                                                    | Gating                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 🟢 **Green**  | Storefront/Catalog front-end, UI polish, pure refactors, docs.                                         | Plan goes in the PR, not pre-approved. Merge on green CI; architect spot-checks async. |
| 🟡 **Yellow** | Most back-end feature work that isn't security-sensitive.                                              | Plan in the PR; architect reviews before merge.                                        |
| 🔴 **Red**    | **Auth**, **Payments**, anything touching money / PII / sessions, any schema design, new dependencies. | Interactive plan approval first; architect review and merge.                           |

When in doubt, go up a tier. A Green ticket that turns out to need a schema or auth change becomes Red the moment that's discovered. Even after activation, **Stop-and-ask still applies to every tier.**

## The board in Notion

Everything lives under the **Slater Street Creative** page. Use these IDs directly instead of searching (if a fetch 404s, re-search for "Project Board" and update this list):

- Parent page **"Slater Street Creative"**: `393f60d0-1252-8151-8a39-d9e6538c1c7c`
- **Project Board** database: `cf97acd3-6561-4057-9eef-db08c3fb6685` — data source: `collection://e41275e1-3849-46c0-a280-c4197ec79751`
- **Epics** database: `3d7e855e-64ba-4ca1-bbc2-bfab5ad66376` — data source: `collection://0e1d8673-ba48-4f59-bfa8-a7e57aba91e5`

### Resolve a ticket by its number

**Don't semantic-search for it.** `SSC-#` is the auto-increment **`Ticket`** property; it isn't in page titles, URLs, or body text, so searching "SSC-17" won't find it. The `SSC-` prefix is display-only — the queryable value is the bare integer, so **`SSC-17` → `Ticket = 17`**. Resolve it exactly, no candidate-hunting:

**From a shell / CI / headless agent (preferred — no MCP, no rate limits):**

```
npm run ticket SSC-17               # human-readable report (properties + Context/AC/Notes)
npm run ticket -- SSC-17 --json     # machine-readable (the --json flag needs the `--`)
```

`scripts/notion-ticket.ts` hits the Notion **REST** `databases/{id}/query` with an exact `unique_id` filter, then reads the page blocks. It needs `NOTION_API_KEY` (an internal-integration token shared with the board — see `.env.example`); unset, it prints a setup hint. This route avoids the MCP collection-query router, which rate-limits intermittently (`collection_router_upstream_429`, retry ~30s).

**From an interactive Claude Code session (MCP), two steps:**

1. **Resolve** SSC-17 → its page. Query the data source on the integer (SQL mode):

   ```sql
   SELECT "Ticket", "Name", "Status", "Domain", "Layer", "Priority", "Sequence", url
   FROM "collection://e41275e1-3849-46c0-a280-c4197ec79751"
   WHERE "Ticket" = 17
   ```

2. **Read the body** — `notion-fetch` the `url` from step 1 for Context / Acceptance criteria / Notes. `fetch` renders the id as `"Ticket":"SSC-17"` (prefixed) and goes through a healthier page route than the query router.

**Fallback — only if the query router 429s.** Batch several ids into one `WHERE "Ticket" IN (…)`; or, if SQL mode is unavailable, `notion-fetch` the data source to list candidate pages and fetch candidates **in parallel**, matching on the `Ticket` property. (The `npm run ticket` helper sidesteps all of this.)

### Board properties

- **Status** — `Backlog` → `To Do` → `In Progress` → `In Review` → `Done`.
- **Sequence** (number) — dependency-ordered "what's next"; lower = sooner. Blank = blocked or not yet defined. The **Up Next** view sorts by it.
- **Priority** — High / Medium / Low (importance, independent of order).
- **Layer** — Back End / Front End / Infra. **Domain** — feature area (Storefront, Catalog, Cart/Checkout, Payments, Auth, Admin, Platform) — also the future tier-routing key.
- **Epic** — relation to the phase epic. **Phase** — read-only rollup of the epic's number.

### Keeping it current

- Start a ticket → `Status` = `In Progress`. PR open → `In Review`. Merged + branch deleted → `Done`. Via MCP: `notion-update-page` with `{"command":"update_properties","properties":{"Status":"In Progress"}}` (values: `Backlog`, `To Do`, `In Progress`, `In Review`, `Done`).
- Follow-up work → create a ticket (Context / Acceptance criteria / Notes, with Layer / Domain / Epic). Leave `Sequence` blank.
- **Sequencing is the architect's call** — don't renumber tickets unilaterally.
- Pick work top-down from **Up Next**; don't start a ticket whose dependencies aren't Done. If the next item is blocked, raise it rather than skipping ahead silently.
