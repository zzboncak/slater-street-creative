# CLAUDE.md

Read `AGENTS.md` first — it is the canonical guide (stack, commands, conventions, known issues, security rules). `WORKFLOW.md` defines the ticket loop and review gates. This file only adds Claude-specific notes.

## Claude-specific notes

- Zack prefers to discuss a plan before implementation. For anything beyond a small, well-defined task, propose an approach and wait for approval before writing code.
- Explain what code does — Zack doesn't run code he doesn't understand. When you write something non-obvious, include a brief plain-language explanation.
- Verify before finishing: `npx tsc --noEmit && npm run lint && npm run format`. There are no tests yet, so also sanity-check changed pages against `npm run dev:db` when feasible.
- Keep changes scoped to the current task. Log unrelated findings (see `AUDIT.md` for the known list) instead of fixing them inline.
- Money is integer cents everywhere. Never trust client-supplied prices; re-price from the DB.
- Any new admin mutation must check for an ADMIN-role session inside the server action/route itself.
