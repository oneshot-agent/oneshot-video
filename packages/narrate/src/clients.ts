/** ElevenLabs text-to-speech over REST. The request shape is the baseline's; narrate() checks it before calling. */
import type { Tts } from "./index.ts";

export function elevenLabsTts(): Tts {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return async (text, req) => {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${req.voice_id}?output_format=${req.output_format}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: req.model_id,
        voice_settings: { stability: req.stability, style: req.style, use_speaker_boost: true },
      }),
    });
    if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
