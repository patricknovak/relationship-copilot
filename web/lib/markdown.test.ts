import { describe, it, expect } from "vitest";
import { renderArticleBlocks } from "@/lib/markdown";

describe("renderArticleBlocks", () => {
  it("groups consecutive bullet lines into one list", () => {
    const blocks = renderArticleBlocks("- one\n- two\n- three");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "list",
      items: [
        [{ text: "one", bold: false }],
        [{ text: "two", bold: false }],
        [{ text: "three", bold: false }],
      ],
    });
  });

  it("splits paragraphs on blank lines", () => {
    const blocks = renderArticleBlocks("First para.\n\nSecond para.");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      spans: [{ text: "First para.", bold: false }],
    });
  });

  it("parses bold spans within text", () => {
    const blocks = renderArticleBlocks("a **bold** word");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      spans: [
        { text: "a ", bold: false },
        { text: "bold", bold: true },
        { text: " word", bold: false },
      ],
    });
  });

  it("handles bold inside bullets", () => {
    const blocks = renderArticleBlocks("- **Key** point here");
    expect(blocks[0]).toEqual({
      type: "list",
      items: [
        [
          { text: "Key", bold: true },
          { text: " point here", bold: false },
        ],
      ],
    });
  });

  it("returns empty for empty input", () => {
    expect(renderArticleBlocks("")).toEqual([]);
    expect(renderArticleBlocks("   ")).toEqual([]);
  });
});
