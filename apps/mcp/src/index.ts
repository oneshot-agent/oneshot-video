/**
 * demoVideo: the MCP tool that lets a coding agent order the launch film once its build is live.
 * The tool definition and handle() are plain exports any client can wire into its own transport;
 * serve() wires them into @modelcontextprotocol/sdk's stdio transport behind a dynamic import, so
 * this package — and its tests — install and run without that package as a dependency.
 */
import type { RunOptions } from "@oneshot-video/pipeline";
import type { RenderResult } from "@oneshot-video/shared-types";

export interface DemoVideoInput {
  app_url: string;
  length_s?: number;
  hint?: string;
}

export interface DemoVideoResult {
  video_url: string;
  silent_video_url: string;
  cost: number;
}

/** JSON Schema for the tool's input, in the shape @oneshot-agent/mcp-server's tools use. */
export const demoVideoInputSchema = {
  type: "object",
  properties: {
    app_url: {
      type: "string",
      format: "uri",
      description: "The deployed app's URL. This is what gets recorded and narrated.",
    },
    length_s: {
      type: "integer",
      minimum: 10,
      maximum: 60,
      description: "Target film length in seconds, 10-60. Defaults to 30.",
    },
    hint: {
      type: "string",
      description: "One line from the caller on what the film should show.",
    },
  },
  required: ["app_url"],
  additionalProperties: false,
} as const;

export const demoVideoTool = {
  name: "demoVideo",
  description:
    "Order the launch film for a deployed app. Call this once a build is live: it reads app_url, " +
    "drives its main flow in a browser, records it, writes and narrates a script, and renders a " +
    "fixed, opinionated film — the same render OneShot's server-side demo-video tool produces. " +
    "Returns { video_url, silent_video_url, cost } once rendering finishes; silent_video_url is a " +
    "captioned cut with no voice track, for muted feeds. length_s (10-60, default 30) sets the " +
    "target length; hint is one line on what to show. Paid tool — see this package's README for " +
    "the payment TODO.",
  inputSchema: demoVideoInputSchema,
};

export class DemoVideoInputError extends Error {}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Runtime validation matching demoVideoInputSchema; the schema above is the declared contract. */
export function validateDemoVideoInput(args: Record<string, unknown>): DemoVideoInput {
  const app_url = args["app_url"];
  if (typeof app_url !== "string" || !isHttpUrl(app_url)) {
    throw new DemoVideoInputError("app_url must be an http(s) URL string");
  }

  let length_s: number | undefined;
  if (args["length_s"] !== undefined) {
    const raw = args["length_s"];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 10 || raw > 60) {
      throw new DemoVideoInputError("length_s must be an integer between 10 and 60");
    }
    length_s = raw;
  }

  let hint: string | undefined;
  if (args["hint"] !== undefined) {
    if (typeof args["hint"] !== "string") throw new DemoVideoInputError("hint must be a string");
    hint = args["hint"];
  }

  return {
    app_url,
    ...(length_s !== undefined ? { length_s } : {}),
    ...(hint !== undefined ? { hint } : {}),
  };
}

export interface HandleDeps {
  /** Normally `run` from @oneshot-video/pipeline; injected so tests never pay. */
  run: (opts: RunOptions) => Promise<RenderResult>;
}

/**
 * Validates args, calls run(), and narrows the result to what a paying caller needs.
 *
 * Payment: stubbed. Per one-shot #881, `POST /v1/tools/video/demo` is the quote-to-pay route this
 * call should settle through before it runs for real; today every call runs the full pipeline free.
 */
export async function handle(
  args: Record<string, unknown>,
  deps: HandleDeps,
): Promise<DemoVideoResult> {
  const input = validateDemoVideoInput(args);
  // Payment stub: per one-shot #881, `POST /v1/tools/video/demo` is the quote-to-pay route this
  // call should settle through before running. No quote or charge happens here yet.
  const result = await deps.run(input);
  return {
    video_url: result.video_url,
    silent_video_url: result.silent_video_url,
    cost: result.cost,
  };
}

/**
 * Wires demoVideoTool + handle() into @modelcontextprotocol/sdk's stdio transport. The module
 * specifiers are held in variables so TypeScript treats the imports as untyped instead of trying
 * (and failing) to resolve a package this repo does not depend on.
 */
export async function serve(): Promise<void> {
  const serverMod = "@modelcontextprotocol/sdk/server/index.js";
  const stdioMod = "@modelcontextprotocol/sdk/server/stdio.js";
  const typesMod = "@modelcontextprotocol/sdk/types.js";
  const { Server } = await import(serverMod);
  const { StdioServerTransport } = await import(stdioMod);
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import(typesMod);
  const { run } = await import("@oneshot-video/pipeline");

  const server = new Server(
    { name: "oneshot-video-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [demoVideoTool] }));
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
      if (request.params.name !== "demoVideo") {
        return {
          content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
          isError: true,
        };
      }
      try {
        const result = await handle(request.params.arguments ?? {}, { run });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  await serve();
}
