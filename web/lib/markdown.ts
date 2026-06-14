// Tiny, dependency-free renderer for the limited markdown used in education
// article bodies: paragraphs, `- ` bullet lists, and `**bold**` spans. Pure
// and tested; the page component maps these blocks to JSX. We deliberately do
// NOT support raw HTML — only these structural primitives — so article text
// can never inject markup.

export interface Span {
  text: string;
  bold: boolean;
}

export type Block =
  | { type: "paragraph"; spans: Span[] }
  | { type: "list"; items: Span[][] };

// Split a line of text into bold / non-bold spans on **markers**.
function parseSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      spans.push({ text: text.slice(last, m.index), bold: false });
    }
    spans.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    spans.push({ text: text.slice(last), bold: false });
  }
  return spans.length ? spans : [{ text, bold: false }];
}

export function renderArticleBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const paragraphs = body.split(/\n\n+/);

  for (const para of paragraphs) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // A block is a list if every line is a bullet; otherwise a paragraph
    // (joining wrapped lines with a space).
    const allBullets = lines.every((l) => l.startsWith("- "));
    if (allBullets) {
      blocks.push({
        type: "list",
        items: lines.map((l) => parseSpans(l.slice(2).trim())),
      });
    } else {
      blocks.push({ type: "paragraph", spans: parseSpans(lines.join(" ")) });
    }
  }

  return blocks;
}
