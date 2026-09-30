# oneshot-video

> **Paste a repo, get a true 30-second launch film of the product working, voiced and silent, with nobody recording anything.**

**[oneshot-video.ngrok.app](https://oneshot-video.ngrok.app)** · [TASTE.md](./TASTE.md) · [docs.oneshotagent.com](https://docs.oneshotagent.com)

[![Built with oneshot-sdk](https://img.shields.io/badge/built%20with-oneshot--sdk-0a0a0a?style=flat&labelColor=18181b&color=22c55e)](https://www.npmjs.com/package/@oneshot-agent/sdk) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Bun](https://img.shields.io/badge/runtime-Bun%201.3+-fbf0df?logo=bun&logoColor=black)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/typed-TypeScript%206-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## The answer

Everything that ships needs a video, and most of those videos are a screen recording with someone
talking over it. `oneshot-video` makes the film from the product itself, and it can be trusted to
do that unattended for three reasons:

1. **It films the real product, running.** An agent boots the repo, gives it data, and proves its
   own shot list works before the camera rolls.
2. **It only says what the screen shows.** The script is written from the footage and checked
   against it, line by line.
3. **It fits how software ships now.** A coding agent can order the film the moment a build
   finishes, and anyone can watch it being made.

Each is expanded below; the reference material follows.

## 1. It films the real product, running

- **The repo is booted, not screenshotted.** It is cloned into an E2B sandbox that already runs
  Postgres and Redis. An agent reads the code, switches on the app's demo mode or seeds its
  database, and starts it. A URL skips this step.
- **The workflow is chosen for what you asked to see.** The agent picks three to six screens that
  show it, with the clicks and fills needed to get there, and logs in first if the app has a wall.
- **The shot list is proven before it is filmed.** The agent runs it in a real browser inside the
  box and fixes what fails: a selector that misses, a login wall, a blank page, a popup left open.
- **The camera sees what the agent saw.** It runs the same shot list inside the box at 1920×1080
  and closes on-load popups before every still.
- **A run that cannot be filmed says so.** A native mobile app, an app that needs a hosted API key
  nobody supplied, or stills that all show one screen stop the run with the reason on its page,
  instead of producing a film of a spinner.

## 2. It only says what the screen shows

- **The writer sees the stills.** They go to the model as images, in order, and every number,
  name and label it uses must be readable in one of them.
- **A second model fact-checks the script against the footage.** Any line the stills do not
  support (a number under the wrong label, a count the screen does not show) sends the draft back.
- **A claim gate is the backstop.** Every number and name must appear in the app's own text.
- **Each film is written for its product.** It opens on what this product changes, in its
  audience's terms, and closes on its name and promise. A formula opening or a licence close is
  sent back.
- **The craft is fixed on purpose.** Voice, score, palette, pacing and word caps are one film,
  encoded as the gates in `packages/baseline` and described in [TASTE.md](./TASTE.md). Published
  as `@oneshot-agent/video-baseline` and `@oneshot-agent/video-film`, so this repo and OneShot's
  server-side `demo-video` tool render the same thing. `bun test` is the taste regression.

## 3. It fits how software ships now

- **Coding agents can order it.** `demoVideo` is an MCP tool: a repo or URL in,
  `{ id, status_url, status_json_url, eta_s }` back at once. `demoVideoStatus({ id })` returns
  the record; `wait: true` blocks until the film is rendered.
- **Every run is watchable live.** `/r/<id>` shows the stages as they pass, the agent's turn and
  what it has found, the stills as they land, and both cuts at the end. `/r/<id>.json` is the
  same record for agents.
- **Both cuts, every time.** A voiced MP4, and a silent one with captions for muted feeds.
- **Priced per video.** Each film is one call with a signed receipt, not a seat.

|               | Screen Studio, Clueso, Supademo, HeyGen | oneshot-video                                     |
| ------------- | --------------------------------------- | ------------------------------------------------- |
| Input         | You record your screen                  | A repo or a URL. An agent boots it and drives it  |
| Who orders it | A person                                | A coding agent, over MCP, when the build finishes |
| Pricing       | Seat per month                          | Per video, signed receipt                         |
| Look          | Their templates                         | One opinionated film, MIT, fork it                |
| Output        | An editor session                       | Voiced + silent MP4, 30 s, both cuts every time   |

---

## Reference

### Quick start

```bash
bun run cli -- https://your.app            # 30 s, voiced + silent cuts
bun run cli -- https://your.app --dry-run  # the plan, no paid calls
bun run intake:serve                       # the form and status pages on :3034
bun run intake:loop                        # the runner that drains the queue
```

### The box

`packages/explore/template` is the E2B template a repo is prepared in: 4 vCPU and 8 GB; Node 22
with pnpm and yarn, Bun, Python with uv, build tools; Postgres and Redis running with a `demo`
database; Playwright's Chromium and `check-workflow`, the camera's own code, for the agent. Docker
is not available, so a `docker-compose.yml` is mapped onto the local services.

```bash
bun run template:build    # build or rebuild it (after changing the camera or the plan format)
bun run template:smoke    # 17 checks that the box has what the agent is told it has
bun run template:matrix   # the harness on a spread of public repos, two at a time
```

### What is OneShot and what is local

| Stage                   | Today                                                  | Later                                     |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Boot and prepare a repo | OneShot's sandbox agent (`run-agent.ts`) in an E2B box | the same, on OneShot's compute tier       |
| Read the app            | `@oneshot-agent/sdk` `webRead()`, else a plain fetch   | same                                      |
| Shoot                   | Playwright inside the box                              | same                                      |
| Write and fact-check    | OpenRouter, with the stills attached                   | same                                      |
| Narrate, score, render  | ElevenLabs + Remotion here                             | same, or a OneShot render route           |
| Pay for it              | the webRead receipt                                    | `POST /v1/tools/video/demo`, quote-to-pay |

### Layout

```
apps/cli            bun run cli -- <url> [--length 30] [--silent-only] [--url-check] [--out renders/] [--dry-run]
apps/intake         the form, the queue, /r/<id> and its JSON, the runner
apps/mcp            @oneshot-video/mcp: demoVideo and demoVideoStatus
packages/explore    boot, the sandbox harness, the camera, the E2B template
packages/script     stills + page text → OpenRouter → script.json, gated and fact-checked
packages/narrate    ElevenLabs stems, measured with ffprobe
packages/film       @oneshot-agent/video-film: the Remotion composition
packages/baseline   @oneshot-agent/video-baseline: the taste and its gates
packages/pipeline   stages, the status record, events.jsonl, the result contract
packages/record     Playwright recording from a flow.json (URL runs with --video)
```

### Sponsors used, honestly

OpenRouter carries every model call: the sandbox agent, the script writer and the fact-check. The
Remotion render can run on a Vultr or Crusoe box instead of a laptop. Nothing else in the Hack Day
sponsor list has an honest place in a repo→video pipeline, so nothing else is in it.

### Hack Day

Built at The AI Conference Hack Day, 29 Sep 2026, Pier 48. Every team in the building has to
submit a video.
