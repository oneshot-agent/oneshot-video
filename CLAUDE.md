# oneshot-video

The launch-film wrapper over OneShot. Bun, not Node. Commands run from this directory.

**TASTE.md and `packages/baseline/src/gates.ts` are law.** A render that fails a gate does not
ship. Do not add a spring config, a voice setting, a colour or a bed outside `packages/baseline`;
that package is published as `@oneshot-agent/video-baseline` and OneShot's server-side
`demo-video` tool imports it, so a value that lives anywhere else is a value the server never sees.

`packages/film` is published as `@oneshot-agent/video-film` for the same reason. Both are
source-published (no build step), like `@oneshot-gtm/*`.

Stages that spend money (script → OneShot webRead, narrate → ElevenLabs) take injectable clients
so tests never pay. `--dry-run` must exit before any network call.

Never push, tag, or publish without being asked.
