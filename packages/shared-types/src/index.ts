/** The script schema is the launch film's `script.json`, unchanged, plus optional scene hints. */

export interface DeliveryCues {
  pace: string;
  energy: string;
  emphasis_words: string[];
  pause_before_seconds: number;
  pause_after_seconds: number;
  delivery_note?: string;
}

export type SceneKind = "text_card" | "capture" | "terminal" | "endtag";

export interface Section {
  id: string;
  label: string;
  text: string;
  start_seconds: number;
  end_seconds: number;
  speaker_directions?: string;
  delivery_cues: DeliveryCues;
  metadata?: Record<string, unknown> | null;
  /** What the canvas shows during this section. Defaults: first/last text_card, rest capture. */
  kind?: SceneKind;
  /** Literal strings the viewer sees on canvas: URLs, commands. Each must be observed or verified. */
  on_screen?: string[];
  /** The voice carries something the picture does not. The silent cut must promote it to type. */
  narration_only?: boolean;
  silentFallback?: string;
  /** For UI-reveal beats: seconds after the section start before the voice may begin. */
  speak_after_settle?: number;
}

export interface VoicePerformance {
  performance_intent: string;
  pacing_profile: string;
  energy_curve: string;
  pause_policy: string;
  sample_section_id?: string;
  provider_notes?: Record<string, string>;
}

export interface Script {
  version: string;
  title: string;
  total_duration_seconds: number;
  voice_performance: VoicePerformance;
  sections: Section[];
  metadata?: unknown;
}

export interface Stem {
  id: string;
  path: string;
  duration_s: number;
  lufs?: number;
}

export interface Recording {
  path: string;
  width: number;
  height: number;
  fps: number;
  duration_s: number;
  /** URLs and visible commands the recorder actually saw. Feeds the noTaughtErrors gate. */
  observed: string[];
}

export interface Scene {
  id: string;
  kind: SceneKind;
  start_seconds: number;
  end_seconds: number;
  /** Crop focus in recording fractions [x, y, w]; one move per scene, then it stops. */
  focus?: {
    from: [number, number, number];
    to: [number, number, number];
    moveStart: number;
    moveEnd: number;
  };
  caption?: string;
  /** Where in the continuous recording this scene's footage starts. The film is not continuous; the recording is. */
  recording_offset_s?: number;
  /** A still of one page, served by the film's staticFile(). When set, the beat is cut from the still with a camera move, not from video. */
  still?: string;
  still_width?: number;
  still_height?: number;
}

export interface PageShot {
  url: string;
  path: string;
  title: string;
  png: string;
  width: number;
  height: number;
}

export interface Explored {
  base_url: string;
  pages: PageShot[];
  observed: string[];
  boot?: {
    backend: "e2b" | "none";
    /** harness: the sandbox agent prepared the app; recipe: package.json scripts, read from outside. */
    mode?: "harness" | "recipe";
    install?: string;
    start?: string;
    port?: number;
    seconds: number;
    /** Why the harness was not used, when mode is "recipe". */
    harness_note?: string;
  };
  /** What the harness agent learned about the app, when it prepared it. */
  harness?: {
    app: { name: string; what_it_does: string; wedge_hint?: string; proof_hint?: string };
    workflow: { id: string; path: string; caption: string }[];
    demo_mode?: string | null;
    seeded?: string[];
    turns?: number;
  };
}

export interface ScenePlan {
  scenes: Scene[];
  total_seconds: number;
}

export interface TtsRequest {
  voice_id: string;
  model_id: string;
  stability: number;
  style: number;
  output_format: string;
}

export interface RenderResult {
  video_url: string;
  silent_video_url: string;
  script: Script;
  scenes: Scene[];
  cost: number;
}

export interface StageEvent {
  ts: string;
  tool: string;
  event: "start" | "finish";
  output_path?: string;
  success?: boolean;
  cost_usd?: number;
  duration_s?: number;
  note?: string;
}

export interface GateResult {
  ok: boolean;
  reason: string;
  notes?: string[];
}
