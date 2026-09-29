# apps/mcp — `@oneshot-video/mcp`

`demoVideo({ app_url, length_s?, hint? })`: the tool an MCP client calls to order the launch film
once its build is live. This is the row that separates oneshot-video from a screen recorder — a
coding agent orders the video itself, over MCP, instead of a person recording their screen.

- `demoVideoTool` — the tool definition (name, description, JSON Schema input), in the shape
  `@oneshot-agent/mcp-server`'s tools use.
- `handle(args, { run })` — validates `args` against the schema, calls the injected `run()` (in
  production, `run` from `@oneshot-video/pipeline`), and narrows the result to
  `{ video_url, silent_video_url, cost }`. `run` is injected so tests never render or pay.
- `serve()` — wires `demoVideoTool` and `handle()` into an MCP stdio server via
  `@modelcontextprotocol/sdk`, imported dynamically so this package installs and its tests run
  without that dependency present. Run `bun run apps/mcp/src/index.ts` with the SDK installed to
  start the server.

Input schema: `app_url` (required, `string`, `format: "uri"`), `length_s` (optional integer,
10–60, default 30), `hint` (optional string, one line on what to show).

## Payment — stubbed

Every call runs the full `@oneshot-video/pipeline` `run()` for free today. Per one-shot #881, the
paid route is `POST /v1/tools/video/demo` — a quote-to-pay flow this tool should settle through
before rendering. `handle()` has a comment at the call site marking where that quote-to-pay step
belongs; wiring it in is follow-up work, not part of this issue.
