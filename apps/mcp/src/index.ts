/**
 * demoVideo: the MCP tool that lets a coding agent order the launch film once its build is live.
 * The tool definition and handle() are plain exports any client can wire into its own transport;
 * serve() wires them into @modelcontextprotocol/sdk's stdio transport behind a dynamic import, so
 * this package — and its tests — install and run without that package as a dependency.
 */
import type { Status, Submission } from "@oneshot-video/intake";
import type { RunOptions } from "@oneshot-video/pipeline";
import type { RenderResult } from "@oneshot-video/shared-types";

export interface DemoVideoInput {
  /** A deployed app, shot as it is. One of app_url / repo_url. */
  app_url?: string;
  /** A GitHub repo, booted in a sandbox, seeded and shot. One of app_url / repo_url. */
  repo_url?: string;
  length_s?: number;
  hint?: string;
  /** Block until the film is rendered instead of returning the status URL at once. */
  wait?: boolean;
}

/** What a caller gets back at once: where to watch the run and where to poll it. */
export interface DemoVideoQueued {
  id: string;
  status: "queued";
  status_url: string;
  status_json_url: string;
  eta_s: number;
}

export interface DemoVideoResult {
  id?: string;
  status_url?: string;
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
      description: "A deployed app's public URL. It is shot as it is. Give this or repo_url.",
    },
    repo_url: {
      type: "string",
      format: "uri",
      description:
        "A public GitHub repo. An agent boots it in a sandbox, switches on its demo mode or seeds it, and picks the workflow to film. Give this or app_url.",
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
    wait: {
      type: "boolean",
      description:
        "false (default): return { id, status_url } at once and poll demoVideoStatus. true: block until rendered.",
    },
  },
  additionalProperties: false,
} as const;

export const demoVideoTool = {
  name: "demoVideo",
  description:
    "Order the launch film for an app, from its deployed URL (app_url) or its GitHub repo " +
    "(repo_url). Returns at once with { id, status_url, status_json_url, eta_s }: status_url is a " +
    "page a person can watch live, and demoVideoStatus({ id }) returns the same record as JSON. " +
    "When the run is done the record carries video_url and silent_video_url (a captioned cut with " +
    "no voice track, for muted feeds). A repo takes a few minutes before the camera starts. " +
    "length_s (10-60, default 30) sets the target length; hint is one line on what to show; " +
    "wait: true blocks until rendered instead. Paid tool — see this package's README for the " +
    "payment TODO.",
  inputSchema: demoVideoInputSchema,
};

export const demoVideoStatusTool = {
  name: "demoVideoStatus",
  description:
    "The live status of a demoVideo run: stage (queued, booting, shooting, script, narrating, " +
    "planning, gates, rendering, done, failed), the latest detail line, the sandbox agent's turn " +
    "and notes, the stills shot so far, and at done the video URLs. Poll every 10-30 s.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "The id demoVideo returned." } },
    required: ["id"],
    additionalProperties: false,
  } as const,
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
  const repo_url = args["repo_url"];
  if (app_url !== undefined && (typeof app_url !== "string" || !isHttpUrl(app_url)))
    throw new DemoVideoInputError("app_url must be an http(s) URL string");
  if (
    repo_url !== undefined &&
    (typeof repo_url !== "string" || !/^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(repo_url))
  )
    throw new DemoVideoInputError("repo_url must be a https://github.com/<owner>/<repo> URL");
  if ((app_url === undefined) === (repo_url === undefined))
    throw new DemoVideoInputError("give exactly one of app_url or repo_url");

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
  if (args["wait"] !== undefined && typeof args["wait"] !== "boolean")
    throw new DemoVideoInputError("wait must be a boolean");

  return {
    ...(typeof app_url === "string" ? { app_url } : {}),
    ...(typeof repo_url === "string" ? { repo_url } : {}),
    ...(length_s !== undefined ? { length_s } : {}),
    ...(hint !== undefined ? { hint } : {}),
    ...(args["wait"] === true ? { wait: true } : {}),
  };
}

export interface HandleDeps {
  /** Normally `run` from @oneshot-video/pipeline; injected so tests never pay. */
  run: (opts: RunOptions) => Promise<RenderResult>;
  /** Normally the intake's enqueue(): the same queue the form feeds. */
  enqueue: (s: Omit<Submission, "id" | "ts">) => Submission;
  statusUrl: (id: string) => string;
}

/** A queued run's wall-clock guess: a repo spends a few minutes in the sandbox first. */
export const etaFor = (input: DemoVideoInput) => (input.repo_url ? 480 : 180);

/**
 * Validates args and queues the run, returning where to watch it; with wait: true, runs it and
 * returns the render.
 *
 * Payment: stubbed. Per one-shot #881, `POST /v1/tools/video/demo` is the quote-to-pay route this
 * call should settle through before it runs for real; today every call runs the full pipeline free.
 */
export async function handle(
  args: Record<string, unknown>,
  deps: HandleDeps,
): Promise<DemoVideoQueued | DemoVideoResult> {
  const input = validateDemoVideoInput(args);
  // Payment stub: per one-shot #881, `POST /v1/tools/video/demo` is the quote-to-pay route this
  // call should settle through before running. No quote or charge happens here yet.
  const sub = deps.enqueue({
    url: (input.repo_url ?? input.app_url) as string,
    kind: input.repo_url ? "repo" : "app",
    contact: "mcp",
    hint: input.hint ?? "",
  });
  const status_url = deps.statusUrl(sub.id);
  if (!input.wait)
    return {
      id: sub.id,
      status: "queued",
      status_url,
      status_json_url: `${status_url}.json`,
      eta_s: etaFor(input),
    };
  const { wait: _wait, ...runInput } = input;
  const result = await deps.run({ ...runInput, id: sub.id });
  return {
    id: sub.id,
    status_url,
    video_url: result.video_url,
    silent_video_url: result.silent_video_url,
    cost: result.cost,
  };
}

/** demoVideoStatus: the run's record plus the URLs a caller needs. */
export function handleStatus(
  args: Record<string, unknown>,
  deps: { readStatus: (id: string) => Status; statusUrl: (id: string) => string },
): Status & { status_url: string; video_url?: string; silent_video_url?: string } {
  const id = args["id"];
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id))
    throw new DemoVideoInputError("id must be the id demoVideo returned");
  const st = deps.readStatus(id);
  const base = deps.statusUrl(id).replace(/\/r\/[^/]+$/, "");
  return {
    ...st,
    status_url: deps.statusUrl(id),
    ...(st.video ? { video_url: base + st.video } : {}),
    ...(st.silent ? { silent_video_url: base + st.silent } : {}),
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
  const { enqueue, readStatus, statusUrl } = await import("@oneshot-video/intake");

  const server = new Server(
    { name: "oneshot-video-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [demoVideoTool, demoVideoStatusTool],
  }));
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
      if (request.params.name === "demoVideoStatus") {
        try {
          const st = handleStatus(request.params.arguments ?? {}, { readStatus, statusUrl });
          return { content: [{ type: "text", text: JSON.stringify(st, null, 2) }] };
        } catch (e) {
          return {
            content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
            isError: true,
          };
        }
      }
      if (request.params.name !== "demoVideo") {
        return {
          content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
          isError: true,
        };
      }
      try {
        const result = await handle(request.params.arguments ?? {}, { run, enqueue, statusUrl });
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
