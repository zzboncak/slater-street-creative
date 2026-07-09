// Resolve a Project Board ticket by its SSC-# id over the Notion REST API — for
// shells, CI, and headless agents that don't have the Notion MCP. Mirrors the
// two-step recipe in WORKFLOW.md → "Resolve a ticket by its number":
//   1. query the board on the integer Ticket id  (SSC-31 → Ticket = 31)
//   2. read the page's blocks for Context / Acceptance criteria / Notes
//
//   npm run ticket SSC-31            # human-readable report
//   npm run ticket -- SSC-31 --json  # raw JSON (page id, properties, blocks) for tooling
//
// Needs NOTION_API_KEY: an internal-integration token (https://www.notion.so/my-integrations)
// with the Project Board shared to it (see .env.example). The `SSC-` prefix is
// display-only; the queryable value is the bare integer, matched with Notion's
// `unique_id` filter — the exact, deterministic primitive for an auto-increment-id
// property. No semantic search, no candidate-matching, no hunting. Unlike the MCP
// collection-query router (which rate-limits — `collection_router_upstream_429`),
// this hits the REST database-query route.
import { existsSync } from "node:fs";

const NOTION_API = "https://api.notion.com/v1";
// Pinned REST version. 2022-06-28 is the stable, widely-supported version whose
// `databases/{id}/query` accepts the `unique_id` filter.
const NOTION_VERSION = "2022-06-28";
// The Project Board database + its ticket-number property (WORKFLOW.md → "The
// board in Notion"). Only as stable as the workspace — a rebuild reassigns ids;
// update both here and the doc if a query starts 404-ing.
const PROJECT_BOARD_DATABASE_ID = "cf97acd3-6561-4057-9eef-db08c3fb6685";
const TICKET_PROPERTY = "Ticket";

// ── Minimal shapes of the Notion API responses we actually read ──────────────
interface RichText {
  plain_text: string;
}
interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}
interface NotionProperty {
  type: string;
  title?: RichText[];
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  number?: number | null;
  unique_id?: { prefix: string | null; number: number };
  status?: { name: string } | null;
}
interface NotionBlock {
  type: string;
  has_children?: boolean;
  // Each block carries its content under a key equal to its `type`
  // (e.g. block.paragraph.rich_text); typed loosely and narrowed at read time.
  [key: string]: unknown;
}

/** Parse "SSC-31", "ssc-31", "#31", or "31" into the integer 31. */
function parseTicketNumber(raw: string): number {
  const digits = raw
    .replace(/^ssc[-\s]?/i, "")
    .replace(/^#/, "")
    .trim();
  const n = Number(digits);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `"${raw}" is not a ticket id — expected e.g. SSC-31, #31, or 31.`,
    );
  }
  return n;
}

/** Authenticated Notion REST call; throws with the response body on non-2xx so a
 *  version/endpoint mismatch or a permissions problem surfaces plainly. */
async function notion<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Notion ${path} → ${res.status} ${res.statusText}: ${body}`,
    );
  }
  return (await res.json()) as T;
}

/** Resolve SSC-N → its board page via the exact unique_id filter (one row). */
async function findTicketPage(
  apiKey: string,
  ticketNumber: number,
): Promise<NotionPage | null> {
  const { results } = await notion<{ results: NotionPage[] }>(
    apiKey,
    `/databases/${PROJECT_BOARD_DATABASE_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: TICKET_PROPERTY,
          unique_id: { equals: ticketNumber },
        },
        page_size: 1,
      }),
    },
  );
  return results[0] ?? null;
}

/** All top-level blocks of a page, following pagination. */
async function fetchPageBlocks(
  apiKey: string,
  pageId: string,
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor
      ? `?start_cursor=${cursor}&page_size=100`
      : "?page_size=100";
    const page = await notion<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(apiKey, `/blocks/${pageId}/children${query}`);
    blocks.push(...page.results);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

function plainText(rt: RichText[] | undefined): string {
  return (rt ?? []).map((t) => t.plain_text).join("");
}

/** One display line per property we care about. */
function formatProperties(page: NotionPage): string {
  const p = page.properties;
  const ticket = p[TICKET_PROPERTY]?.unique_id;
  const id = ticket
    ? `${ticket.prefix ? `${ticket.prefix}-` : ""}${ticket.number}`
    : "?";
  const name = plainText(p.Name?.title);
  const status = p.Status?.select?.name ?? p.Status?.status?.name ?? "?";
  const domain = p.Domain?.select?.name ?? "—";
  const layer =
    (p.Layer?.multi_select ?? []).map((o) => o.name).join(" + ") || "—";
  const priority = p.Priority?.select?.name ?? "—";
  const sequence = p.Sequence?.number ?? "—";
  return [
    `${id} — ${name}`,
    `Status: ${status}   Domain: ${domain}   Layer: ${layer}   Priority: ${priority}   Sequence: ${sequence}`,
    `URL: ${page.url}`,
  ].join("\n");
}

/** Render a page's blocks back to readable Markdown-ish text. Covers the block
 *  types a ticket body uses (headings, paragraphs, to-dos, lists, quotes, etc.). */
function formatBlocks(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const data = b[b.type] as
      { rich_text?: RichText[]; checked?: boolean } | undefined;
    const text = plainText(data?.rich_text);
    switch (b.type) {
      case "heading_1":
        lines.push(`\n# ${text}`);
        break;
      case "heading_2":
        lines.push(`\n## ${text}`);
        break;
      case "heading_3":
        lines.push(`\n### ${text}`);
        break;
      case "to_do":
        lines.push(`- [${data?.checked ? "x" : " "}] ${text}`);
        break;
      case "bulleted_list_item":
        lines.push(`- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`1. ${text}`);
        break;
      case "quote":
        lines.push(`> ${text}`);
        break;
      case "callout":
        lines.push(`💡 ${text}`);
        break;
      case "divider":
        lines.push("---");
        break;
      case "code":
        lines.push(`\`\`\`\n${text}\n\`\`\``);
        break;
      default:
        if (text) lines.push(text);
    }
  }
  return lines.join("\n").trim();
}

async function main(): Promise<void> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }

  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const idArg = args.find((a) => !a.startsWith("--"));
  if (!idArg) {
    // `--json` is an npm flag, so it must follow the `--` separator to reach us.
    console.error(
      "Usage: npm run ticket SSC-31    (JSON: npm run ticket -- SSC-31 --json)",
    );
    process.exit(1);
  }

  // Validate the id before anything else, so obviously-bad input fails fast
  // regardless of whether the token is configured.
  const ticketNumber = parseTicketNumber(idArg);

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error(
      "NOTION_API_KEY is not set. Create an internal integration at\n" +
        "https://www.notion.so/my-integrations, share the Project Board with it,\n" +
        "and add the token to .env (see .env.example). Interactive Claude Code\n" +
        "sessions can use the Notion MCP instead (WORKFLOW.md).",
    );
    process.exit(1);
  }
  const page = await findTicketPage(apiKey, ticketNumber);
  if (!page) {
    console.error(
      `No ticket with ${TICKET_PROPERTY} = ${ticketNumber} on the board.`,
    );
    process.exit(1);
  }

  const blocks = await fetchPageBlocks(apiKey, page.id);

  if (asJson) {
    console.log(
      JSON.stringify(
        { id: page.id, url: page.url, properties: page.properties, blocks },
        null,
        2,
      ),
    );
    return;
  }

  console.log(formatProperties(page));
  console.log("\n" + formatBlocks(blocks));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
