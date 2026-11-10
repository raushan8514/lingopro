import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { formatCertificateIssueDate } from "./date.js";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const DARK = rgb(0.1, 0.16, 0.14);
const MUTED = rgb(0.37, 0.43, 0.4);
const GREEN = rgb(0.04, 0.38, 0.28);
const PALE = rgb(0.95, 0.97, 0.95);

function clean(value) {
  return String(value || "").normalize("NFC").replace(/[\u0000-\u001f]/g, " ").trim();
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = "";
    } else {
      line = candidate;
    }
    if (font.widthOfTextAtSize(line || word, fontSize) > maxWidth) {
      let part = "";
      for (const character of word) {
        const nextPart = `${part}${character}`;
        if (part && font.widthOfTextAtSize(nextPart, fontSize) > maxWidth) {
          lines.push(part);
          part = character;
        } else {
          part = nextPart;
        }
      }
      line = part;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createCertificatePdf({
  studentName,
  courseTitle,
  certificateNumber,
  issuedAt,
  verificationUrl,
}) {
  const fontPath = join(
    process.cwd(),
    "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
  );
  const fontBytes = await readFile(fontPath);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(fontBytes, { subset: true });
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const safeName = clean(studentName);
  const safeTitle = clean(courseTitle);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: PALE,
  });
  page.drawRectangle({
    x: 26,
    y: 26,
    width: PAGE_WIDTH - 52,
    height: PAGE_HEIGHT - 52,
    borderColor: GREEN,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: PAGE_WIDTH - 68,
    height: PAGE_HEIGHT - 68,
    borderColor: rgb(0.75, 0.84, 0.79),
    borderWidth: 0.7,
  });

  page.drawText("LINGOPRO", {
    x: 56,
    y: 512,
    size: 12,
    font,
    color: GREEN,
    characterSpacing: 2.4,
  });
  page.drawText("CERTIFICATE OF COMPLETION", {
    x: 56,
    y: 455,
    size: 31,
    font,
    color: DARK,
  });
  page.drawText("This certificate is awarded to", {
    x: 56,
    y: 405,
    size: 14,
    font,
    color: MUTED,
  });

  const nameLines = wrapText(safeName, font, 26, PAGE_WIDTH - 112).slice(0, 2);
  nameLines.forEach((line, index) => {
    page.drawText(line, {
      x: 56,
      y: 357 - index * 34,
      size: 26,
      font,
      color: GREEN,
    });
  });

  const courseStartY = 286 - Math.min(nameLines.length - 1, 1) * 34;
  page.drawText("for successfully completing", {
    x: 56,
    y: courseStartY,
    size: 14,
    font,
    color: MUTED,
  });
  const courseFontSize = safeTitle.length > 100 ? 16 : 20;
  const courseLines = wrapText(
    safeTitle,
    font,
    courseFontSize,
    PAGE_WIDTH - 112,
  ).slice(0, 3);
  courseLines.forEach((line, index) => {
    page.drawText(line, {
      x: 56,
      y: courseStartY - 38 - index * 24,
      size: courseFontSize,
      font,
      color: DARK,
    });
  });

  page.drawLine({
    start: { x: 56, y: 129 },
    end: { x: PAGE_WIDTH - 56, y: 129 },
    thickness: 0.8,
    color: rgb(0.75, 0.84, 0.79),
  });
  page.drawText(`Issued ${formatCertificateIssueDate(issuedAt)}`, {
    x: 56,
    y: 101,
    size: 11,
    font,
    color: MUTED,
  });
  page.drawText(`Certificate ${clean(certificateNumber)}`, {
    x: 56,
    y: 78,
    size: 10,
    font,
    color: MUTED,
  });
  page.drawText("Verify this record", {
    x: 545,
    y: 101,
    size: 11,
    font,
    color: GREEN,
  });
  wrapText(clean(verificationUrl), font, 7, PAGE_WIDTH - 600)
    .slice(0, 2)
    .forEach((line, index) => {
      page.drawText(line, {
        x: 545,
        y: 81 - index * 10,
        size: 7,
        font,
        color: MUTED,
      });
  });

  return document.save();
}
