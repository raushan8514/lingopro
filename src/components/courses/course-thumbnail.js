"use client";

import { useState } from "react";
import { BookOpen, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CourseThumbnail({
  src,
  variant = "card",
  priority = false,
}) {
  const [failed, setFailed] = useState(false);
  const isDetail = variant === "detail";
  const Icon = isDetail ? BookOpen : Languages;

  return (
    <>
      {src && !failed && (
        // Course images use instructor-provided HTTP(S) URLs validated by the database.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={cn(
            "market-course-thumbnail-image",
            isDetail && "market-course-thumbnail-image-detail",
          )}
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <span
        className={cn(
          "market-course-thumbnail-fallback",
          src && !failed && "is-covered",
          isDetail && "market-course-thumbnail-fallback-detail",
        )}
        aria-hidden="true"
      >
        <Icon size={isDetail ? 38 : 34} strokeWidth={1.5} />
      </span>
    </>
  );
}
