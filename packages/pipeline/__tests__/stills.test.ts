import { describe, expect, it } from "vitest";
import { selectStills } from "../src/index.ts";

describe("selectStills", () => {
  it("drops a still caught mid-load and a repeat, keeps the order", () => {
    const loading = { id: "1", text: ["NeoDash Movies Dashboard", "Total movies"] };
    const loaded = { id: "2", text: ["NeoDash Movies Dashboard", "Total movies", "171"] };
    const actor = { id: "3", text: ["Actor View", "Tom Hanks", "13"] };
    const again = { id: "4", text: ["Actor View", "Tom Hanks", "13"] };
    expect(selectStills([loading, loaded, actor, again]).map((p) => p.id)).toEqual(["2", "3"]);
  });
  it("keeps stills that recorded no text, and never returns nothing", () => {
    const a = { id: "a" };
    const b = { id: "b", text: [] as string[] };
    expect(selectStills([a, b]).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
