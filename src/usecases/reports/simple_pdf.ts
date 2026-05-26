export type PdfLine = {
  text: string;
  fontSize?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 52;
const DEFAULT_FONT_SIZE = 10;
const MAX_TEXT_CHARS = 92;

function sanitizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value: string): string {
  return sanitizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const cleanText = sanitizeText(text);
  if (cleanText.length <= maxChars) return [cleanText];

  const words = cleanText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (currentLine.length + word.length + 1 <= maxChars) {
      currentLine = `${currentLine} ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [cleanText.slice(0, maxChars)];
}

function lineHeight(fontSize: number): number {
  return Math.ceil(fontSize * 1.35);
}

function paginate(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [[]];
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  for (const line of lines) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    const wrappedLines = wrapText(
      line.text,
      Math.max(32, Math.floor(MAX_TEXT_CHARS * (10 / fontSize))),
    );

    for (const wrappedLine of wrappedLines) {
      const requiredHeight = lineHeight(fontSize) + (line.gapAfter ?? 0);
      if (cursorY - requiredHeight < MARGIN_BOTTOM) {
        pages.push([]);
        cursorY = PAGE_HEIGHT - MARGIN_TOP;
      }

      pages[pages.length - 1]?.push({
        text: wrappedLine,
        fontSize,
        gapAfter: line.gapAfter,
      });
      cursorY -= requiredHeight;
    }
  }

  return pages;
}

function buildPageContent(lines: PdfLine[]): string {
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;
  const chunks: string[] = [];

  for (const line of lines) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    chunks.push(
      `BT /F1 ${fontSize} Tf ${MARGIN_X} ${cursorY} Td (${escapePdfString(line.text)}) Tj ET`,
    );
    cursorY -= lineHeight(fontSize) + (line.gapAfter ?? 0);
  }

  return `${chunks.join("\n")}\n`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function createSimplePdf(lines: PdfLine[]): Uint8Array {
  const pages = paginate(lines);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects[3] = "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  let nextObjectId = 4;
  for (const pageLines of pages) {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;

    pageObjectIds.push(pageObjectId);
    const pageContent = buildPageContent(pageLines);
    objects[pageObjectId] =
      `${pageObjectId} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>\n` +
      "endobj\n";
    objects[contentObjectId] =
      `${contentObjectId} 0 obj\n` +
      `<< /Length ${byteLength(pageContent)} >>\n` +
      "stream\n" +
      pageContent +
      "endstream\n" +
      "endobj\n";
  }

  objects[2] =
    "2 0 obj\n" +
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageObjectIds.length} >>\n` +
    "endobj\n";

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const objectBody = objects[objectId];
    if (!objectBody) continue;
    offsets[objectId] = byteLength(output);
    output += objectBody;
  }

  const startXref = byteLength(output);
  output += `xref\n0 ${objects.length}\n`;
  output += "0000000000 65535 f \n";
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const offset = offsets[objectId] ?? 0;
    output += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  output += `startxref\n${startXref}\n%%EOF\n`;

  return new TextEncoder().encode(output);
}
