# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## What this is

A read-only MCP server over the Cin7 Core (formerly DEAR) REST API v2, shipped as a `.mcpb` desktop extension for Claude Desktop. It exposes three tools: `get_stock_levels`, `list_purchases` and `get_purchase`. The server sends only `GET` requests. Domain terms are defined in `CONTEXT.md`.

## Commands

```sh
npm install
npm run typecheck                       # tsc --noEmit
npm test                                # vitest run, all tests
npx vitest run test/get-purchase.test.ts        # one file
npx vitest run -t "falls back to StockReceived" # tests matching a name
npm run build                           # esbuild src/index.ts into bundle/server/index.js
npm run pack                            # version check, build, validate manifest, write cin7-core.mcpb
```

Tests run without network access or Cin7 keys.

## Architecture

- `src/index.ts` is the only place the keys are read (`CIN7_ACCOUNT_ID`, `CIN7_APPLICATION_KEY`). It exits when either is missing, registers the three tools with `readOnlyHint`, and turns a thrown error into a tool error whose message the user sees.
- `src/cin7.ts` is the only HTTP client. It adds the two auth headers, drops blank query values, retries once after 5 seconds on HTTP 429 or 503, and maps failures to `Cin7Error` messages written for the end user. Any other non-200 body is passed through with the keys redacted.
- `src/tools/*.ts` each export `name`, `description`, `inputSchema` (Zod, from `zod/v4`), a pure mapping function from the Cin7 response to the tool result, and a handler that calls the client. Tests exercise the mapping functions against `test/fixtures/`, and the handlers against a stubbed client.
- `bundle/` is the directory handed to `mcpb pack`. `bundle/manifest.json` declares the two keys as sensitive `user_config` fields and maps them to the environment variables. `bundle/server/index.js` is generated and ignored by git.

Things that are easy to get wrong:

- Use `@modelcontextprotocol/server` (SDK v2) with `serveStdio`. The package `@modelcontextprotocol/sdk` is the older v1 line.
- Log with `console.error` only. Stdout carries the MCP protocol.
- Keep the keys out of every log line, error message and tool result.
- List pages are fixed at `PAGE_SIZE` (100). `src/tools/paging.ts` writes the "more results" note.
- `get_purchase` calls `/advanced-purchase` for every purchase type. A lookup by order number first searches `/purchaseList` and keeps only an exact, case-insensitive match. Receipts come from `PutAway`, falling back to `StockReceived`, and skip sections that are `NOT AVAILABLE`, `DRAFT` or `VOIDED`.
- Status and type fields from Cin7 are typed as plain strings, since Cin7 returns values outside its documented lists.
- An empty result is a normal result with a note, never an error.

## Testing status

The fixtures are the sample responses from Cin7's API documentation. Live behaviour with valid keys is still unverified, including which receipt list Cin7 fills for each purchase type. Treat the mapping rules as documented behaviour until a live account confirms them.

## Releasing

`.github/workflows/release.yml` runs on every push to `main`: typecheck, tests, pack, and upload of the bundle as a workflow artifact. It publishes a GitHub release only when the current version has no release yet.

To cut a release, set the same version in `package.json`, `bundle/manifest.json` and the `McpServer` call in `src/index.ts`, run `npm install --package-lock-only`, and push to `main`. `scripts/check-version.mjs` fails the build when the three disagree. The release asset is always named `cin7-core.mcpb`, which keeps the README's download link pointing at the newest release.

## Conventions

- Commit messages use conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`).
- User-facing text in the README and in tool messages is written for a non-technical reader.
