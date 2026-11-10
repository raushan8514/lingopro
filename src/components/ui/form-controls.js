"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function FieldLabel({ htmlFor, children, required }) {
  return (
    <label className="ui-label" htmlFor={htmlFor}>
      {children}
      {required && (
        <span className="ui-required" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

function FieldMessage({ id, error, hint }) {
  const message = error || hint;
  if (!message) return null;

  return (
    <span
      id={id}
      className={error ? "ui-field-error" : "ui-field-hint"}
      role={error ? "alert" : undefined}
    >
      {message}
    </span>
  );
}

export function Input({
  id: providedId,
  label,
  error,
  hint,
  required,
  className,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <input
        id={id}
        className={cn("ui-input", error && "ui-control-invalid", className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        required={required}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function Textarea({
  id: providedId,
  label,
  error,
  hint,
  required,
  className,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <textarea
        id={id}
        className={cn("ui-input ui-textarea", error && "ui-control-invalid", className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        required={required}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function Select({
  id: providedId,
  label,
  error,
  hint,
  required,
  className,
  children,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const messageId = `${id}-message`;

  return (
    <div className="ui-field">
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <span className="ui-select-wrap">
        <select
          id={id}
          className={cn("ui-input ui-select", error && "ui-control-invalid", className)}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          required={required}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="ui-select-icon" size={16} aria-hidden="true" />
      </span>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function Checkbox({ id: providedId, label, description, className, ...props }) {
  const generatedId = useId();
  const id = providedId || generatedId;

  return (
    <div className={cn("ui-choice-row", className)}>
      <input id={id} className="ui-checkbox" type="checkbox" {...props} />
      <label className="ui-choice-label" htmlFor={id}>
        <span className="ui-choice-title">{label}</span>
        {description && <span className="ui-choice-description">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({
  id: providedId,
  checked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}) {
  const generatedId = useId();
  const id = providedId || generatedId;

  return (
    <div className={cn("ui-choice-row", className)}>
      <button
        id={id}
        className="ui-switch"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span className="ui-switch-thumb" />
      </button>
      <label className="ui-choice-label" htmlFor={id}>
        <span className="ui-choice-title">{label}</span>
        {description && <span className="ui-choice-description">{description}</span>}
      </label>
    </div>
  );
}
