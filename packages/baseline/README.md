# @oneshot-agent/video-baseline

The taste of the OneShot launch film as constants and gates. Pure TypeScript plus one asset
(`score.mp3`). No renderer, no browser, no TTS client — a server can import it, and OneShot's
`demo-video` tool does.

```ts
import { runGates, TTS_REQUEST, BED_PATH } from "@oneshot-agent/video-baseline";

const report = runGates({ script, stems, observed, scenes, bedPath: BED_PATH, tts: TTS_REQUEST });
if (!report.ok) throw new Error(`taste: ${report.failed.join(", ")}`);
```

| Module       | What it fixes                                                  |
| ------------ | -------------------------------------------------------------- |
| `tokens`     | palette, type, frame size                                      |
| `motion`     | the one spring; terminal and camera rules                      |
| `voice`      | ElevenLabs settings, pace, pause floor, the performance intent |
| `music`      | `score.mp3`, its hash, mix levels, the style as a device       |
| `vocabulary` | banned words, CTA-lift phrases                                 |
| `structure`  | the 30-second shape                                            |
| `gates`      | one check per way v1 went wrong; `runGates()`                  |

`fixtures/oneshot-gtm-launch.script.json` is the real launch script and must pass every gate.
`fixtures/v1-shaped.script.json` is what the first cut looked like and must fail. Both ship in
the package so a consumer can run the same regression.
