/**
 * Plain text → Atlassian Document Format (ADF) for Jira issue descriptions.
 * Blank lines separate paragraphs; single newlines become hard breaks; https
 * URLs get link marks. Text is never interpreted as markup.
 */

type TextNode = { type: 'text'; text: string; marks?: Array<{ type: 'link'; attrs: { href: string } }> };
type InlineNode = TextNode | { type: 'hardBreak' };
type ParagraphNode = { type: 'paragraph'; content: InlineNode[] };

export interface AdfDocument {
  type: 'doc';
  version: 1;
  content: ParagraphNode[];
}

const URL_PATTERN = /https:\/\/[^\s<>"]+/g;

function inlineText(line: string): TextNode[] {
  const nodes: TextNode[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(/[.,;:!?)]+$/, '');
    if (start > last) nodes.push({ type: 'text', text: line.slice(last, start) });
    nodes.push({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] });
    last = start + url.length;
  }
  if (last < line.length) nodes.push({ type: 'text', text: line.slice(last) });
  return nodes;
}

export function plainTextToAdf(text: string): AdfDocument {
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((paragraph) => {
      const content: InlineNode[] = [];
      paragraph.split('\n').forEach((line, index) => {
        if (index > 0) content.push({ type: 'hardBreak' });
        content.push(...inlineText(line));
      });
      return { type: 'paragraph', content };
    }),
  };
}
