import type {
  BriefBlock,
  BriefInlineNode,
  DashboardBriefDocument,
} from "./dashboard-types";

const headingPattern = /^(#{2,4})\s+(.+)$/;
const unorderedListPattern = /^[-*]\s+(.+)$/;
const orderedListPattern = /^(\d+)\.\s+(.+)$/;

export function parseBriefMarkdown(markdown: string): BriefBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BriefBlock[] = [];
  let index = 0;
  let ignoredTitle = false;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (!ignoredTitle && /^#\s+/.test(line)) {
      ignoredTitle = true;
      index += 1;
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 2 | 3 | 4,
        content: parseInlineNodes(heading[2]),
      });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(line).map(parseInlineNodes);
      index += 2;
      const rows: BriefInlineNode[][][] = [];

      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]).map(parseInlineNodes));
        index += 1;
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const unorderedItem = line.match(unorderedListPattern);
    const orderedItem = line.match(orderedListPattern);
    if (unorderedItem || orderedItem) {
      const ordered = Boolean(orderedItem);
      const pattern = ordered ? orderedListPattern : unorderedListPattern;
      const start = orderedItem ? Number.parseInt(orderedItem[1], 10) : undefined;
      const items: BriefInlineNode[][] = [];

      while (index < lines.length) {
        const item = lines[index].match(pattern);
        if (!item) break;
        items.push(parseInlineNodes(item[ordered ? 2 : 1]));
        index += 1;
      }

      blocks.push({ type: "list", ordered, ...(start === undefined ? {} : { start }), items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && isParagraphLine(lines, index, ignoredTitle)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: parseInlineNodes(paragraphLines.join(" ")),
      });
      continue;
    }

    index += 1;
  }

  return blocks;
}

export function selectBriefVersion(
  documents: DashboardBriefDocument[],
  date: string,
  version?: string,
): DashboardBriefDocument | null {
  const documentsForDate = documents.filter((document) => document.date === date);

  if (version === undefined) {
    return documentsForDate.find((document) => document.isLatest) ?? null;
  }

  return documentsForDate.find((document) => document.versionLabel === version) ?? null;
}

export function versionsForDate(
  documents: DashboardBriefDocument[],
  date: string,
): DashboardBriefDocument[] {
  return documents
    .filter((document) => document.date === date)
    .sort((left, right) => right.version - left.version);
}

function isTableStart(lines: string[], index: number): boolean {
  return isTableRow(lines[index]) && isTableSeparator(lines[index + 1]);
}

function isTableRow(line: string | undefined): line is string {
  return Boolean(line && line.includes("|"));
}

function isTableSeparator(line: string | undefined): boolean {
  if (!line) return false;

  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isParagraphLine(
  lines: string[],
  index: number,
  ignoredTitle: boolean,
): boolean {
  const line = lines[index];
  return (
    line.trim() !== "" &&
    !headingPattern.test(line) &&
    !isTableStart(lines, index) &&
    !unorderedListPattern.test(line) &&
    !orderedListPattern.test(line) &&
    !(!ignoredTitle && /^#\s+/.test(line))
  );
}

function parseInlineNodes(text: string): BriefInlineNode[] {
  const nodes: BriefInlineNode[] = [];
  let index = 0;

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        nodes.push({ type: "strong", text: text.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end !== -1) {
        nodes.push({ type: "code", text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    const link = parseMarkdownLink(text, index);
    if (link) {
      const href = safeHttpHref(link.href);
      if (href) {
        nodes.push({ type: "link", text: link.text, href });
      } else {
        appendText(nodes, link.text);
      }
      index = link.end;
      continue;
    }

    appendText(nodes, text[index]);
    index += 1;
  }

  return nodes;
}

function parseMarkdownLink(
  text: string,
  index: number,
): { text: string; href: string; end: number } | null {
  if (text[index] !== "[") return null;

  const labelEnd = text.indexOf("](", index + 1);
  if (labelEnd === -1) return null;

  let cursor = labelEnd + 2;
  let depth = 1;
  while (cursor < text.length && depth > 0) {
    if (text[cursor] === "(") depth += 1;
    if (text[cursor] === ")") depth -= 1;
    cursor += 1;
  }

  if (depth !== 0) return null;

  return {
    text: text.slice(index + 1, labelEnd),
    href: text.slice(labelEnd + 2, cursor - 1),
    end: cursor,
  };
}

function safeHttpHref(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

function appendText(nodes: BriefInlineNode[], text: string): void {
  const previous = nodes[nodes.length - 1];
  if (previous?.type === "text") {
    previous.text += text;
  } else {
    nodes.push({ type: "text", text });
  }
}
