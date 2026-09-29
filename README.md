# oneshot-video

> The launch-film wrapper over OneShot. A URL in, a 30-second product video out, voiced and silent. The taste is a package.

**[docs.oneshotagent.com](https://docs.oneshotagent.com)** · [TASTE.md](./TASTE.md) · [one-shot #881](https://github.com/tormine/oneshot/issues/881)

```bash
bun run cli -- https://your.app            # 30 s, voiced + silent cuts
bun run cli -- https://your.app --dry-run  # the plan, no paid calls
```

[![Built with oneshot-sdk](https://img.shields.io/badge/built%20with-oneshot--sdk-0a0a0a?style=flat&labelColor=18181b&color=22c55e)](https://www.npmjs.com/package/@oneshot-agent/sdk) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Bun](https://img.shields.io/badge/runtime-Bun%201.3+-fbf0df?logo=bun&logoColor=black)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/typed-TypeScript%206-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What this is

[OneShot](https://docs.oneshotagent.com) is a pay-per-use toolbox for agents — email, SMS, voice,
research, browser, build, commerce — settled per call with a signed receipt for every action.

`oneshot-video` is the launch-film wrapper. It reads an app, drives its main flow in a browser,
records it, writes a terse script, narrates it, scores it, and renders a 30-second cut in one
fixed film: the voice, the bed, the palette and the motion of the oneshot-gtm launch video. The
film is not configurable. It is encoded — as constants and as gates a render has to pass — and
published as `@oneshot-agent/video-baseline` and `@oneshot-agent/video-film`, so this CLI and
OneShot's server-side `demo-video` tool render the same thing.

MIT, so you can read the prompt and fork the film.

### Why not Screen Studio / Clueso / Supademo / HeyGen

|               | Them                   | oneshot-video                                     |
| ------------- | ---------------------- | ------------------------------------------------- |
| Input         | You record your screen | A URL. An agent drives it                         |
| Who orders it | A person               | A coding agent, over MCP, when the build finishes |
| Pricing       | Seat per month         | Per video, signed receipt                         |
| Look          | Their templates        | One opinionated film, MIT, fork it                |
| Output        | An editor session      | Voiced + silent MP4, 30 s, both cuts every time   |

Row two is the point. Claude Code, Codex and Hermes ship apps all day and none of them can make
the video.

## The film is a package

[TASTE.md](./TASTE.md) is the film in words. `packages/baseline` is the film in code: tokens,
motion, voice, music, vocabulary, structure, and eleven gates — one per way the first launch
video went wrong. The real launch script ships as a fixture and must pass every gate; a
`v1-shaped` fixture must fail. `bun test` is the taste regression.

## What is OneShot and what is local

| Stage                            | Today                                         | Per #881, later                           |
| -------------------------------- | --------------------------------------------- | ----------------------------------------- |
| Read the app to write the script | `@oneshot-agent/sdk` `webRead()` → OpenRouter | same                                      |
| Drive and record the flow        | local Playwright                              | OneShot browser agent, compute tier       |
| Narrate, score, render           | ElevenLabs + Remotion here                    | same, or a OneShot render route           |
| Pay for it                       | the webRead receipt                           | `POST /v1/tools/video/demo`, quote-to-pay |
| Boot from a repo                 | —                                             | E2B boot step                             |

## Layout

```
apps/cli           bun run cli -- <url> [--length 30] [--flow flow.json] [--silent-only] [--dry-run]
apps/mcp           stretch: demoVideo as an x402-payable MCP tool (README only)
packages/baseline  @oneshot-agent/video-baseline — the taste
packages/film      @oneshot-agent/video-film — the Remotion composition
packages/script    webRead → OpenRouter → script.json, gated
packages/record    Playwright recording from a flow.json
packages/narrate   ElevenLabs stems, measured with ffprobe
packages/pipeline  stages, events.jsonl, the result contract
```

## Sponsors used, honestly

OpenRouter is the only LLM call in the pipeline (the script stage). The Remotion render can run
on a Vultr or Crusoe box instead of a laptop. Nothing else in the Hack Day sponsor list has an
honest place in a URL→video pipeline, so nothing else is in it.

## Hack Day

Built at The AI Conference Hack Day, 29 Sep 2026, Pier 48. Every team in the building has to
record a video by 19:00.
