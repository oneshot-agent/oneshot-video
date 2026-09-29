# The taste

`oneshot-video` renders one film. This file is the film in words; `packages/baseline` is the
film in constants and gates. When they disagree, the gate is right and this file is stale.

The reference is the oneshot-gtm launch film (`oneshot-launch-voiced.mp4`, rendered 22 Aug
2026). Its decision log has four sentences that decide most things:

> "The argument is 'this exists and runs on your machine'. Only real pixels carry that."
>
> "Opens on an inversion, ends on the receipt. Argument first, features as evidence."
>
> "A launch video that teaches a 404 is worse than no launch video."
>
> "Timeline rebuilt from measured stems rather than forcing copy into the old estimates."

## What v1 got wrong

The first cut of that film was not good, and the record says exactly how. Every item below is
now a gate, so it cannot happen again — here or in OneShot's `demo-video` tool.

| v1                                                                           | Gate                  |
| ---------------------------------------------------------------------------- | --------------------- |
| A generated bed, then phonk, lofi and froid beds before `score.mp3`          | `bedIsScore`          |
| Male voices (Daniel, Roger v2/v3) before Sarah; explainer-voice takes        | `flatEnergy`          |
| Scene windows estimated, then copy forced into them                          | `measuredTimeline`    |
| An install command on screen that would have 404'd (`bunx oneshot-gtm init`) | `noTaughtErrors`      |
| The voice reading the command the viewer could already see                   | `dontReadTheCommand`  |
| A lift at the CTA; hype vocabulary                                           | `voiceLint`           |
| No silence after full stops; speaking over UI the viewer was reading         | `silenceRespected`    |
| A silent cut that was just a mute                                            | `silentCutIsNotAMute` |
| Designed graphics where captured pixels were the argument                    | `realPixels`          |
| A second easing vocabulary creeping into one component                       | `oneMotionVocabulary` |

## Picture

1920×1080, 30 fps, H.264 + AAC. The product's own tokens: warm deep black `#120F0C`, cream
`#F5F1EA`, amber `#E8A63D` for money out, green `#47B777` for anything that came back, red
`#C35045` for refused. IBM Plex Mono for anything the machine says; Host Grotesk for titles.
Motion is one spring — `damping 200, mass 0.9, 26 frames` — and nothing overshoots. Camera
moves on captured UI happen once per scene, then stop. Text cards open and close; the middle
is recorded pixels. There is no logo glyph: the mark is the wordmark, so inventing a symbol
would be inventing brand.

## Voice

ElevenLabs `eleven_v3`, Sarah (`EXAVITQu4vr4xnSDxMaL`), stability 0.5, style 0, −18.4 LUFS.
A developer stating facts to other developers. Dry, unhurried, faintly amused. Never sells,
never explains twice. Flat and low throughout, no lift at the CTA. Full stops get real silence.
The voice never speaks over a beat where the viewer is reading. The pace is the film's own:
under 1.95 words a second including its silences, about twelve words a sentence.

## Music

`score.mp3`, always, until music becomes adjustable. Under narration at 0.40, alone at 0.85.
The style, as a device: a ticking pulse around 82 BPM over a low drone on A; overlapping
ascending phrases handed between registers so the tension seems to rise forever and never
resolves; dark and weighty, energy at 120–200 Hz and almost nothing above 3 kHz; tonal, not
drum-led; shaped as a swell. It underscores, it doesn't drive.

## Why it is a package

OneShot's server-side `demo-video` tool (one-shot #881) renders "the audio and look of the
launch film". If the film lived only in this repo, the server would restate it and drift — the
v1 problem, one repo over. If it lived only in the server, this repo would go hollow and you
could not read the prompt or fork the film. So the taste is `@oneshot-agent/video-baseline`
and `@oneshot-agent/video-film`, published from here, imported by both. Open opinion upstream
of the closed rail.
