"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function InstructorAvatar({
  name,
  src,
  className,
  size = "md",
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn("market-public-avatar", `market-public-avatar-${size}`, className)}
      role="img"
      aria-label={`${name} profile image`}
    >
      {showImage && (
        // The profile image URL is a public instructor field returned by a restricted RPC.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
      {!showImage && <span aria-hidden="true">{getInitials(name)}</span>}
    </span>
  );
}
