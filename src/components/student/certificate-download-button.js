"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CertificateDownloadButton({ downloadUrl }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function downloadCertificate() {
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const response = await fetch(downloadUrl, {
        headers: { Accept: "application/pdf" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(message || `Download failed (HTTP ${response.status}).`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("application/pdf")) {
        throw new Error("The server did not return a PDF file.");
      }

      const blob = await response.blob();
      const signature = new TextDecoder().decode(
        await blob.slice(0, 5).arrayBuffer(),
      );
      if (signature !== "%PDF-") {
        throw new Error("The downloaded file is not a valid PDF.");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const filename =
        disposition.match(/filename="([^"]+)"/i)?.[1] ||
        "LingoPro-Certificate.pdf";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Certificate download failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="certificate-download-control">
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={pending}
        onClick={downloadCertificate}
        leftIcon={<Download size={15} aria-hidden="true" />}
      >
        {pending ? "Preparing…" : "Download"}
      </Button>
      {error && (
        <p className="student-form-message is-error" role="alert">
          Download failed: {error}
        </p>
      )}
    </div>
  );
}
