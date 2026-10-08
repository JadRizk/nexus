import { describe, expect, it } from "vitest";
import { href, parseHash } from "./router.js";

describe("parseHash", () => {
  it("reads the bare URL and the root hash as Home", () => {
    expect(parseHash("")).toEqual([]);
    expect(parseHash("#")).toEqual([]);
    expect(parseHash("#/")).toEqual([]);
  });

  it("splits nested routes and ignores stray slashes", () => {
    expect(parseHash("#/tokens")).toEqual(["tokens"]);
    expect(parseHash("#/components/button/")).toEqual(["components", "button"]);
    expect(parseHash("#//components//button")).toEqual(["components", "button"]);
  });

  it("accepts a hash without the leading slash", () => {
    expect(parseHash("#tokens")).toEqual(["tokens"]);
  });
});

describe("href", () => {
  it("round-trips through parseHash, including segments that need encoding", () => {
    for (const segs of [[], ["tokens"], ["components", "key value"], ["a/b"]]) {
      expect(parseHash(href(...segs))).toEqual(segs);
    }
  });
});
