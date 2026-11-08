import { localizeText } from '@/i18n/localize';
export type RichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type RichTextBlock = {
  runs: RichTextRun[];
  listItem?: boolean;
  listKind?: "ul" | "ol";
  listIndex?: number;
  blank?: boolean;
  align?: "left" | "center" | "right";
};

const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;
const HTML_ENTITY_RE = /&(?:[a-z][a-z0-9]+|#[0-9]+|#x[0-9a-f]+);/i;
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "DIV", "P"]);

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const plainTextToRichHtml = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

const createHtmlDocument = () => {
  if (typeof document === "undefined") return null;
  return document.implementation.createHTMLDocument("");
};

const cleanNode = (node: Node, doc: Document, depth = 0, allowAlignment = false): Node[] => {
  if (depth > 64) return [];
  if (node.nodeType === Node.TEXT_NODE) {
    return [doc.createTextNode(node.textContent?.replace(/\u00a0/g, " ") ?? "")];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE"].includes(tag)) return [];
  const cleanedChildren = Array.from(element.childNodes).flatMap((child) => cleanNode(child, doc, depth + 1, allowAlignment));

  if (!ALLOWED_TAGS.has(tag)) return cleanedChildren;

  if (tag === "BR") return [doc.createElement("br")];

  const normalizedTag = tag === "B" || tag === "STRONG" ? "strong" : tag === "I" || tag === "EM" ? "em" : tag.toLowerCase();
  const cleanElement = doc.createElement(normalizedTag);
  if (allowAlignment && ["P", "DIV", "LI", "UL", "OL"].includes(tag)) {
    const align = (element as HTMLElement).style.textAlign || element.getAttribute("align");
    if (align && ["left", "center", "right"].includes(align)) cleanElement.style.textAlign = align;
  }
  cleanedChildren.forEach((child) => cleanElement.appendChild(child));
  return [cleanElement];
};

export const richTextToHtml = (value: string, { allowAlignment = false }: { allowAlignment?: boolean } = {}) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!HTML_TAG_RE.test(trimmed) && !HTML_ENTITY_RE.test(trimmed)) return plainTextToRichHtml(value);

  const doc = createHtmlDocument();
  if (!doc) return plainTextToRichHtml(value);

  const template = doc.createElement("template");
  // Preserve boundary spaces so sanitizing an already-clean value is idempotent.
  template.innerHTML = value;
  const container = doc.createElement("div");
  Array.from(template.content.childNodes)
    .flatMap((node) => cleanNode(node, doc, 0, allowAlignment))
    .forEach((node) => container.appendChild(node));
  return container.innerHTML;
};

const hasText = (runs: RichTextRun[]) => runs.some((run) => run.text.trim().length > 0);

const appendRunsAsBlocks = (
  blocks: RichTextBlock[],
  runs: RichTextRun[],
  listItem = false,
  listKind: "ul" | "ol" = "ul",
  listIndex?: number,
  align?: RichTextBlock["align"],
) => {
  let current: RichTextRun[] = [];
  const flush = () => {
    if (hasText(current)) blocks.push({ runs: current, listItem, listKind, listIndex, ...(align ? { align } : {}) });
    current = [];
  };

  runs.forEach((run) => {
    const parts = run.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) flush();
      if (part) current.push({ ...run, text: part });
    });
  });

  flush();
};

const inlineRunsFromNode = (node: Node, style: Omit<RichTextRun, "text"> = {}): RichTextRun[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ ...style, text: node.textContent?.replace(/\u00a0/g, " ") ?? "" }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (tag === "BR") return [{ ...style, text: "\n" }];

  const nextStyle = {
    ...style,
    bold: style.bold || tag === "B" || tag === "STRONG",
    italic: style.italic || tag === "I" || tag === "EM",
    underline: style.underline || tag === "U",
  };

  return Array.from(element.childNodes).flatMap((child) => inlineRunsFromNode(child, nextStyle));
};

// Contenteditable uses empty paragraphs and nested divs for intentional line breaks.
const blocksWithLineBreaks = (container: HTMLElement): RichTextBlock[] => {
  const blocks: RichTextBlock[] = [];
  let runs: RichTextRun[] = [];
  let lineAlign: RichTextBlock["align"];
  let lineList: { listKind: "ul" | "ol"; listIndex: number; first: boolean } | undefined;
  const flush = (force = false) => {
    if (!runs.length && !force) return;
    const list = lineList?.first ? { listItem: true, listKind: lineList.listKind, listIndex: lineList.listIndex } : {};
    blocks.push({ runs, ...(hasText(runs) ? {} : { blank: true }), ...(lineAlign ? { align: lineAlign } : {}), ...list });
    if (lineList) lineList.first = false;
    runs = [];
  };
  const visit = (node: Node, style: Omit<RichTextRun, "text"> = {}, align?: RichTextBlock["align"], list?: typeof lineList) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = (node.textContent ?? "").split("\n");
      parts.forEach((text, index) => {
        if (!runs.length) { lineAlign = align; lineList = list; }
        if (text) runs.push({ ...style, text });
        if (index < parts.length - 1) flush(true);
      });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement, tag = element.tagName;
    if (tag === "BR") {
      if (!runs.length) { lineAlign = align; lineList = list; }
      flush(true); return;
    }
    const nextStyle = { ...style, bold: style.bold || tag === "STRONG", italic: style.italic || tag === "EM", underline: style.underline || tag === "U" };
    const nextAlign = (element.style.textAlign || align) as RichTextBlock["align"];
    if (tag === "UL" || tag === "OL") {
      flush();
      Array.from(element.children).filter(child => child.tagName === "LI").forEach((child, index) => visit(child, nextStyle, nextAlign, { listKind: tag === "OL" ? "ol" : "ul", listIndex: index + 1, first: true }));
      return;
    }
    const isBlock = tag === "DIV" || tag === "P" || tag === "LI";
    if (isBlock) flush();
    const before = blocks.length;
    Array.from(element.childNodes).forEach(child => visit(child, nextStyle, nextAlign, list));
    if (isBlock) {
      flush();
      if (blocks.length === before) { lineAlign = nextAlign; lineList = list; flush(true); }
    }
  };
  Array.from(container.childNodes).forEach(node => visit(node));
  flush();
  return blocks;
};

export const richTextToBlocks = (value: string, { allowAlignment = false, preserveLineBreaks = false }: { allowAlignment?: boolean; preserveLineBreaks?: boolean } = {}): RichTextBlock[] => {
  const html = richTextToHtml(value, { allowAlignment });
  if (!html) return [];

  const doc = createHtmlDocument();
  if (!doc) {
    return value
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => ({ runs: [{ text: line }] }));
  }

  const container = doc.createElement("div");
  container.innerHTML = html;
  if (preserveLineBreaks) return blocksWithLineBreaks(container);
  const blocks: RichTextBlock[] = [];
  let pendingRuns: RichTextRun[] = [];
  let previousWasLineBreak = false;

  const flushPending = () => {
    const hadText = hasText(pendingRuns);
    appendRunsAsBlocks(blocks, pendingRuns);
    pendingRuns = [];
    return hadText;
  };

  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tag = element.tagName.toUpperCase();

      if (tag === "UL" || tag === "OL") {
        flushPending();
        previousWasLineBreak = false;
        const listKind = tag === "OL" ? "ol" : "ul";
        Array.from(element.children)
          .filter((child) => child.tagName.toUpperCase() === "LI")
          .forEach((li, index) => appendRunsAsBlocks(blocks, inlineRunsFromNode(li), true, listKind, index + 1, ((li as HTMLElement).style.textAlign || (element as HTMLElement).style.textAlign || undefined) as RichTextBlock["align"]));
        return;
      }

      if (tag === "LI") {
        flushPending();
        previousWasLineBreak = false;
        appendRunsAsBlocks(blocks, inlineRunsFromNode(element), true, "ul", undefined, (element as HTMLElement).style.textAlign as RichTextBlock["align"]);
        return;
      }

      if (tag === "DIV" || tag === "P") {
        flushPending();
        previousWasLineBreak = false;
        appendRunsAsBlocks(blocks, inlineRunsFromNode(element), false, "ul", undefined, (element as HTMLElement).style.textAlign as RichTextBlock["align"]);
        return;
      }

      if (tag === "BR") {
        const hadText = flushPending();
        if (!hadText && previousWasLineBreak) blocks.push({ runs: [], blank: true });
        previousWasLineBreak = true;
        return;
      }
    }

    pendingRuns.push(...inlineRunsFromNode(node));
    previousWasLineBreak = false;
  });

  flushPending();
  return blocks;
};

export const richTextToPlainText = (value: string) =>
  richTextToBlocks(value)
    .map((block) => {
      if (block.blank) return "";
      const prefix = block.listItem ? (block.listKind === "ol" ? `${block.listIndex ?? 1}. ` : "- ") : "";
      return `${prefix}${block.runs.map((run) => run.text).join("").trim()}`;
    })
    .join("\n");

const countWrappedPlainTextLines = (text: string, charsPerLine: number) => {
  const safeCharsPerLine = Math.max(1, charsPerLine);
  const sourceLines = (text || "").replace(/\r\n/g, "\n").split("\n");
  if (sourceLines.length === 0) return 1;

  const countLineWraps = (line: string) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 1;

    let lineCount = 1;
    let currentLength = 0;

    words.forEach((word) => {
      const wordLength = word.length;
      if (wordLength > safeCharsPerLine) {
        if (currentLength > 0) {
          lineCount += 1;
          currentLength = 0;
        }
        lineCount += Math.ceil(wordLength / safeCharsPerLine) - 1;
        currentLength = wordLength % safeCharsPerLine;
        return;
      }

      const nextLength = currentLength === 0 ? wordLength : currentLength + 1 + wordLength;
      if (nextLength > safeCharsPerLine) {
        lineCount += 1;
        currentLength = wordLength;
      } else {
        currentLength = nextLength;
      }
    });

    return lineCount;
  };

  return Math.max(1, sourceLines.reduce((sum, line) => sum + countLineWraps(line), 0));
};

export const estimatePlainTextLines = (text: string, charsPerLine: number) => {
  return countWrappedPlainTextLines(text, Math.floor(charsPerLine * 0.9));
};

let measureCanvas: HTMLCanvasElement | null = null;
// Text fitting measures the same rich text at many font sizes. Parsing it into
// a DOM tree again for each size is unnecessary; keep a small, text-keyed cache.
const measuredBlocks = new Map<string, RichTextBlock[]>();
function blocksForMeasurement(value: string, preserveLineBreaks = false) {
  const key = `${preserveLineBreaks ? 1 : 0}:${value}`;
  const cached = measuredBlocks.get(key);
  if (cached) return cached;
  const blocks = richTextToBlocks(value, { preserveLineBreaks });
  if (measuredBlocks.size >= 32) measuredBlocks.delete(measuredBlocks.keys().next().value!);
  measuredBlocks.set(key, blocks);
  return blocks;
}

export const measurePlainTextLines = (text: string, maxWidth: number, font: string) => {
  if (typeof document === "undefined") return estimatePlainTextLines(text, Math.max(1, Math.floor(maxWidth / 18)));

  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return estimatePlainTextLines(text, Math.max(1, Math.floor(maxWidth / 18)));

  ctx.font = font;
  const widths = new Map<string, number>();
  const sourceLines = (text || "").replace(/\r\n/g, "\n").split("\n");
  if (sourceLines.length === 0) return 1;

  const countLineWraps = (line: string) => {
    const tokens = line.split(/(\s+)/).filter(Boolean);
    if (tokens.length === 0) return 1;

    let lineCount = 1;
    let currentWidth = 0;

    tokens.forEach((token) => {
      const isSpace = token.trim() === "";
      let tokenWidth = widths.get(token);
      if (tokenWidth === undefined) { tokenWidth = ctx.measureText(localizeText(token)).width; widths.set(token, tokenWidth); }
      if (isSpace && currentWidth === 0) return;

      // Match overflow-wrap: break-word, including long tokens without spaces.
      if (!isSpace && tokenWidth > maxWidth) {
        if (currentWidth > 0) lineCount += 1;
        currentWidth = 0;
        for (const character of localizeText(token)) {
          const characterWidth = ctx.measureText(character).width;
          if (currentWidth > 0 && currentWidth + characterWidth > maxWidth) {
            lineCount += 1;
            currentWidth = 0;
          }
          currentWidth += characterWidth;
        }
        return;
      }

      if (!isSpace && currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
        lineCount += 1;
        currentWidth = tokenWidth;
      } else {
        currentWidth += tokenWidth;
      }
    });

    return lineCount;
  };

  return Math.max(1, sourceLines.reduce((sum, line) => sum + countLineWraps(line), 0));
};

const setMeasureFont = (ctx: CanvasRenderingContext2D, fontSize: number, run: Pick<RichTextRun, "bold" | "italic"> = {}) => {
  ctx.font = `${run.italic ? "italic " : ""}${run.bold ? "700" : "400"} ${fontSize}px 'Courier Prime', 'Courier New', monospace`;
};

export const measureRichTextLines = (value: string, maxWidth: number, fontSize: number, maxLines = Number.MAX_SAFE_INTEGER, { preserveLineBreaks = false }: { preserveLineBreaks?: boolean } = {}) => {
  if (typeof document === "undefined") return estimateRichTextLines(value, Math.max(1, Math.floor(maxWidth / Math.max(1, fontSize * 0.55))), maxLines);

  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return estimateRichTextLines(value, Math.max(1, Math.floor(maxWidth / Math.max(1, fontSize * 0.55))), maxLines);

  let lines = 0;
  const widths = new Map<string, number>();

  const measureBlock = (runs: RichTextRun[]) => {
    let lineCount = 1;
    let currentWidth = 0;

    runs.forEach((run) => {
      const tokens = run.text.split(/(\s+)/).filter(Boolean);
      setMeasureFont(ctx, fontSize, run);
      tokens.forEach((token) => {
        const isSpace = token.trim() === "";
        if (isSpace && currentWidth === 0) return;

        const key = `${run.bold ? 1 : 0}${run.italic ? 1 : 0}:${token}`;
        let tokenWidth = widths.get(key);
        if (tokenWidth === undefined) { tokenWidth = ctx.measureText(localizeText(token)).width; widths.set(key, tokenWidth); }
        if (!isSpace && tokenWidth > maxWidth) {
          if (currentWidth > 0) lineCount += 1;
          currentWidth = 0;
          for (const character of localizeText(token)) {
            const characterWidth = ctx.measureText(character).width;
            if (currentWidth > 0 && currentWidth + characterWidth > maxWidth) {
              lineCount += 1;
              currentWidth = 0;
            }
            currentWidth += characterWidth;
          }
          return;
        }
        if (!isSpace && currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
          lineCount += 1;
          currentWidth = tokenWidth;
        } else {
          currentWidth += tokenWidth;
        }
      });
    });

    return lineCount;
  };

  for (const block of blocksForMeasurement(value, preserveLineBreaks)) {
    if (lines >= maxLines) break;
    if (block.blank) {
      lines += 1;
      continue;
    }
    const prefix = block.listItem ? (block.listKind === "ol" ? `${block.listIndex ?? 1}. ` : "\u2022 ") : "";
    const runs = block.listItem ? [{ text: prefix, bold: true }, ...block.runs] : block.runs;
    lines += measureBlock(runs);
  }

  return Math.min(maxLines, Math.max(1, lines));
};

export const estimateRichTextLines = (value: string, charsPerLine: number, maxLines: number) => {
  const blocks = richTextToBlocks(value);
  if (blocks.length === 0) return 0;
  const lines = blocks.reduce((sum, block) => {
    if (block.blank) return sum + 1;
    const prefix = block.listItem ? (block.listKind === "ol" ? `${block.listIndex ?? 1}. ` : "- ") : "";
    const text = `${prefix}${block.runs.map((run) => run.text).join("")}`.trim();
    const looksLikeTextListItem = /^[•*-]\s+|\d+[.)]\s+/.test(text);
    const effectiveCharsPerLine = block.listItem ? Math.max(1, Math.floor(charsPerLine * 0.82)) : charsPerLine;
    return sum + countWrappedPlainTextLines(text, effectiveCharsPerLine);
  }, 0);
  return Math.min(maxLines, Math.max(1, lines));
};
