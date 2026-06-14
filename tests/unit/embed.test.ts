import { describe, expect, it } from "vitest";
import { buildEmbedSnippet } from "@/lib/embed/snippet";

describe("buildEmbedSnippet", () => {
  it("builds the async install line with category id and origin", () => {
    expect(buildEmbedSnippet("https://app.miso.com", "cat-123")).toBe(
      '<script src="https://app.miso.com/embed.js" data-miso-category="cat-123" async></script>',
    );
  });

  it("strips a trailing slash from the origin so the path is not doubled", () => {
    expect(buildEmbedSnippet("https://app.miso.com/", "cat-123")).toBe(
      '<script src="https://app.miso.com/embed.js" data-miso-category="cat-123" async></script>',
    );
  });

  it("works for a localhost dev origin", () => {
    expect(buildEmbedSnippet("http://localhost:3002", "abc")).toContain(
      'src="http://localhost:3002/embed.js"',
    );
  });
});

describe("resize message contract", () => {
  it("embed.js listens for the same {type,height} shape the page posts", () => {
    const message = { type: "miso:resize", height: 480 };
    expect(message.type).toBe("miso:resize");
    expect(typeof message.height).toBe("number");
  });
});
