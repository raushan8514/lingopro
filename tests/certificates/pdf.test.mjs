import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { formatCertificateIssueDate } from "../../src/lib/certificates/date.js";
import { createCertificatePdf } from "../../src/lib/certificates/pdf.js";

test("certificate PDF embeds the bundled font and creates a readable document", async () => {
  const bytes = await createCertificatePdf({
    studentName: "José García",
    courseTitle: "Français pour débutants",
    certificateNumber: "LP-ABC123",
    issuedAt: "2026-11-09T12:00:00.000Z",
    verificationUrl: "/verify/abcdef123456",
  });

  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  const { width, height } = document.getPage(0).getSize();
  assert.ok(Math.abs(width - 841.89) < 0.1);
  assert.ok(Math.abs(height - 595.28) < 0.1);
});

test("certificate PDF rejects invalid issue dates", async () => {
  await assert.rejects(
    createCertificatePdf({
      studentName: "Test Student",
      courseTitle: "Test Course",
      certificateNumber: "LP-INVALID",
      issuedAt: "not-a-date",
      verificationUrl: "/verify/invalid",
    }),
    /certificate issue date is invalid/i,
  );
});

test("certificate issue dates use the same UTC calendar date", () => {
  assert.equal(
    formatCertificateIssueDate("2026-11-10T21:40:50.487024Z"),
    "November 10, 2026",
  );
  assert.throws(
    () => formatCertificateIssueDate("not-a-date"),
    /certificate issue date is invalid/i,
  );
});
