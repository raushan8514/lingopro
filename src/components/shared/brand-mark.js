import { Languages } from "lucide-react";
import Link from "next/link";

export default function BrandMark() {
  return (
    <Link className="brand-mark" href="/" aria-label="LingoPro home">
      <span className="brand-icon">
        <Languages size={19} strokeWidth={2} aria-hidden="true" />
      </span>
      <span>
        lingo<span className="brand-accent">pro</span>
      </span>
    </Link>
  );
}
