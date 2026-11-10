import { cn } from "@/lib/utils";

export default function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  className,
}) {
  return (
    <div className={cn("landing-section-heading", `is-${align}`, className)}>
      {eyebrow && <p className="landing-eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {description && <p className="landing-section-description">{description}</p>}
    </div>
  );
}
