import { describe, expect, it } from "vitest";
import { claimsOnScreen } from "../src/index.ts";
import type { Script } from "@oneshot-video/shared-types";

const screen =
  "NeoDash Movies Dashboard\nTotal movies 171\nSelected person Tom Hanks\nMovies 13\nApollo 13";
const script = (lines: string[], text = "The graph, read without Cypher.") =>
  ({
    sections: [{ id: "proof", text, on_screen: lines }],
    total_duration_seconds: 30,
  }) as unknown as Script;

describe("claimsOnScreen", () => {
  it("passes numbers and names that are on the screens", () => {
    expect(claimsOnScreen(script(["Tom Hanks", "13 movies", "Apollo 13", "171"]), screen).ok).toBe(
      true,
    );
  });
  it("fails a name the screens never showed, and a number word that is not there", () => {
    const r = claimsOnScreen(script(["Tom Hanks", "Forrest Gump", "Twelve movies listed"]), screen);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Forrest Gump/);
    expect(r.reason).toMatch(/twelve/);
  });
  it("leaves spelled-out numbers alone in the voice-over", () => {
    expect(
      claimsOnScreen(script(["Tom Hanks"], "Ten seconds, one query, no Cypher."), screen).ok,
    ).toBe(true);
  });
});
