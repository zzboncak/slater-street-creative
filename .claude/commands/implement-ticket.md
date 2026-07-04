---
description: Implement a ticket from the Slater Street Project Board end-to-end (orient → plan → implement → verify → PR).
argument-hint: <SSC-ticket-id, e.g. SSC-1>
---

You are implementing ticket **$ARGUMENTS** from the Slater Street Creative Project
Board. Follow `WORKFLOW.md` exactly. The project is in **fully gated mode**: do not
skip the plan-approval gate, and do not merge — the architect merges.

## 1. Orient

- Read `AGENTS.md` (stack, conventions, known issues, security rules) and `WORKFLOW.md`.
- Check `AUDIT.md` for known issues touching this ticket's area.
- Fetch ticket **$ARGUMENTS** from Notion. **Do not semantic-search for "SSC-N"** — the
  ticket number is the auto-increment `Ticket` property and isn't in titles or body text.
  Instead:
  1. Fetch the Project Board data source: `collection://e41275e1-3849-46c0-a280-c4197ec79751`
     (database: `cf97acd3-6561-4057-9eef-db08c3fb6685`) to list ticket pages.
  2. Fetch likely candidate pages **in parallel** and match on the `Ticket` property
     (e.g. `"Ticket":"SSC-5"`). Properties also carry Domain, Layer, Epic, Priority, Status.
- Read the ticket's Context, Acceptance criteria, and Notes. Note its Domain and Epic.
- Set the ticket's Status to `In Progress` (notion-update-page:
  `{"command":"update_properties","properties":{"Status":"In Progress"}}`).

## 2. Plan (STOP for approval)

Propose a concise plan: which files/migrations you'll touch, what tests you'll write
(once the test suite exists), how you'll verify, and anything that hits a
**Stop-and-ask** trigger from `WORKFLOW.md` (schema design, new dependency,
auth/money/PII scope, ambiguity). **Then stop and wait for approval before writing
any code.**

## 3. Implement

- Branch: `ssc-<ticket#>-<short-slug>` off `main`.
- Smallest change that satisfies the acceptance criteria. One ticket = one PR.
- Money is integer cents; re-price from the DB; admin mutations check ADMIN inside
  the action/route.
- If the ticket changes conventions, schema, or closes a known issue, update
  `AGENTS.md` / `AUDIT.md` in the same branch.

## 4. Verify

- `npx tsc --noEmit` → `npm run lint` → `npm run format` — all green.
- Run `npm test` once the test suite exists (SSC-9).
- Sanity-check affected pages against `npm run dev:db` when feasible.
- For Auth or Payments tickets, run `/security-review`.

## 5. PR

- Open a PR linking `$ARGUMENTS`. The description must include: the approved plan, a
  **plain-language explanation of what the code does** (the architect doesn't merge
  code he doesn't understand), verification output, and any risky/decision-y bits at
  the top.
- Run `/review` as a first pass. Move the ticket to `In Review`.

## Definition of Done

Per `WORKFLOW.md`: acceptance criteria met, verification green, docs in sync, PR
explained and **merged by the architect**, branch deleted. Do not mark the ticket
`Done` until merged and cleaned up.
