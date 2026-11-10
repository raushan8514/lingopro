"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn("ui-dialog", className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="ui-dialog-panel">
        <header className="ui-dialog-header">
          <div>
            <h2 className="ui-dialog-title" id={titleId}>{title}</h2>
            {description && (
              <p className="ui-dialog-description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ui-icon-button"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="ui-dialog-content">{children}</div>
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
