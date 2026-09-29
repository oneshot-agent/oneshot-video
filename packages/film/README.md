# @oneshot-agent/video-film

The launch film as a Remotion 4 composition. Every colour, spring, mix level and rule comes from
`@oneshot-agent/video-baseline`; this package only knows how to draw them.

```bash
bun run studio          # from the repo root — opens DemoVideo on the launch film's real script
```

Compositions: `DemoVideo` (voiced) and `DemoVideoSilent`. Props are `{ script, scenes, stems,
recording?, bed?, target, silent? }`; durations come from `total_seconds`, which the pipeline
measures from stems. `public/` holds what `staticFile()` serves: the bed, the stems, the recording.

Primitives ported from `OneShotLaunch.tsx`: `Line`, `Wordmark`, `CornerMark`, `Field`, `Terminal`,
`Capture`, `FramedCapture`, `CloseLockup`, `WedgeCard`, `SilentLabels`.
