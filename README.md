# oneshot-video

> A repo or a URL in, a 30-second launch film out, voiced and silent. An agent boots your app, finds the workflow worth showing, and films it.

**[oneshot-video.ngrok.app](https://oneshot-video.ngrok.app)** · [TASTE.md](./TASTE.md) · [docs.oneshotagent.com](https://docs.oneshotagent.com)

```bash
bun run cli -- https://your.app            # 30 s, voiced + silent cuts
bun run cli -- https://your.app --dry-run  # the plan, no paid calls
```

Or paste a GitHub repo into [the form](https://oneshot-video.ngrok.app), or let your coding agent
call the `demoVideo` MCP tool. Every route hands back a live status page first.

[![Built with oneshot-sdk](https://img.shields.io/badge/built%20with-oneshot--sdk-0a0a0a?style=flat&labelColor=18181b&color=22c55e)](https://www.npmjs.com/package/@oneshot-agent/sdk) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Bun](https://img.shields.io/badge/runtime-Bun%201.3+-fbf0df?logo=bun&logoColor=black)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/typed-TypeScript%206-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What it does

Everything that ships needs a video: the hackathon submission, the launch post, the README. Most
of them end up as a screen recording with someone talking over it. `oneshot-video` makes the film
from the product itself.

1. **Boot.** A repo is cloned into an E2B sandbox that already runs Postgres and Redis. An agent
   reads the code, switches on the app's demo mode or seeds its database, starts it, and picks
   the three to six screens that show what you asked for. A URL skips this step.
2. **Check.** Before it hands over, the agent runs its own shot list in a real browser inside the
   box and fixes what fails: a selector that misses, a login wall, a blank page, a popup left open.
3. **Shoot.** The camera runs that shot list inside the box at 1920×1080, closing on-load popups
   before every still.
4. **Write.** The script writer sees the stills and writes only what they show, in the product's
   own terms. A second model fact-checks every line against the footage before the voice records.
5. **Narrate and render.** ElevenLabs reads it, Remotion renders it, and both cuts ship: voiced,
   and silent with captions for muted feeds.

A run that cannot be filmed stops and says why, on its status page, rather than filming a
spinner. A native mobile app is refused with the reason, so is an app that needs a hosted API key
nobody supplied, and so are stills that all show the same screen.

### Why not Screen Studio / Clueso / Supademo / HeyGen

|               | Them                   | oneshot-video                                     |
| ------------- | ---------------------- | ------------------------------------------------- |
| Input         | You record your screen | A repo or a URL. An agent boots it and drives it  |
| Who orders it | A person               | A coding agent, over MCP, when the build finishes |
| Pricing       | Seat per month         | Per video, signed receipt                         |
| Look          | Their templates        | One opinionated film, MIT, fork it                |
| Output        | An editor session      | Voiced + silent MP4, 30 s, both cuts every time   |

Row two is the point. Claude Code, Codex and Hermes ship apps all day, and none of them can make
the video.

## The film is a package

The look, the voice, the score and the pacing are fixed on purpose; the words are the product's
own. [TASTE.md](./TASTE.md) is the film in words. `packages/baseline` is the film in code: tokens,
motion, voice, music, vocabulary, structure, and the gates a render has to pass, one per way a
first launch film went wrong. It is published as `@oneshot-agent/video-baseline` and
`@oneshot-agent/video-film`, so this repo and OneShot's server-side `demo-video` tool render the
same thing. `bun test` is the taste regression.

The script is judged before the voice records it: every number and name must appear on the
screens, a fact-checker reads each line against the stills, and the film opens on what this
product changes and closes on its name, not on a formula.

## Live status

Every run gets `/r/<id>`: the stages as they pass, the sandbox agent's turn and what it has
found, the stills as they land, and at the end both cuts. `/r/<id>.json` is the same record for
agents. The MCP tool returns `{ id, status_url, status_json_url, eta_s }` at once;
`demoVideoStatus({ id })` returns the record; `wait: true` blocks until the film is rendered.

## The box

`packages/explore/template` is the E2B template the repo is prepared in: 4 vCPU and 8 GB; Node 22
with pnpm and yarn, Bun, Python with uv, build tools; Postgres and Redis running with a `demo`
database; Playwright's Chromium and `check-workflow`, the camera's own code, for the agent.
Docker is not available, so a `docker-compose.yml` is mapped onto the local services.

```bash
bun run template:build    # build or rebuild it (after changing the camera or the plan format)
bun run template:smoke    # 17 checks that the box has what the agent is told it has
bun run template:matrix   # the harness on a spread of public repos, two at a time
```

## What is OneShot and what is local

| Stage                   | Today                                                  | Later                                     |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Boot and prepare a repo | OneShot's sandbox agent (`run-agent.ts`) in an E2B box | the same, on OneShot's compute tier       |
| Read the app            | `@oneshot-agent/sdk` `webRead()`, else a plain fetch   | same                                      |
| Shoot                   | Playwright inside the box                              | same                                      |
| Write and fact-check    | OpenRouter, with the stills attached                   | same                                      |
| Narrate, score, render  | ElevenLabs + Remotion here                             | same, or a OneShot render route           |
| Pay for it              | the webRead receipt                                    | `POST /v1/tools/video/demo`, quote-to-pay |

## Layout

```
apps/cli            bun run cli -- <url> [--length 30] [--silent-only] [--url-check] [--out renders/] [--dry-run]
apps/intake         the form, the queue, /r/<id> and its JSON, the runner (intake:serve, intake:loop)
apps/mcp            @oneshot-video/mcp: demoVideo and demoVideoStatus
packages/explore    boot, the sandbox harness, the camera, the E2B template
packages/script     stills + page text → OpenRouter → script.json, gated and fact-checked
packages/narrate    ElevenLabs stems, measured with ffprobe
packages/film       @oneshot-agent/video-film: the Remotion composition
packages/baseline   @oneshot-agent/video-baseline: the taste and its gates
packages/pipeline   stages, the status record, events.jsonl, the result contract
packages/record     Playwright recording from a flow.json (URL runs with --video)
```

## Sponsors used, honestly

OpenRouter carries every model call: the sandbox agent, the script writer and the fact-check. The
Remotion render can run on a Vultr or Crusoe box instead of a laptop. Nothing else in the Hack Day
sponsor list has an honest place in a repo→video pipeline, so nothing else is in it.

## Hack Day

Built at The AI Conference Hack Day, 29 Sep 2026, Pier 48. Every team in the building has to
submit a video.
