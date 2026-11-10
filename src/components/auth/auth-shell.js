import Link from "next/link";
import BrandMark from "@/components/shared/brand-mark";
import { FadeUp } from "@/components/shared/animations";
import ThemeSwitcher from "@/components/ui/theme-switcher";

export default function AuthShell({
  children,
  eyebrow,
  title,
  description,
  footer,
  notice,
}) {
  return (
    <main className="auth-page">
      <div className="auth-frame">
        <aside className="auth-aside" aria-label="LingoPro introduction">
          <div className="auth-aside-top">
            <BrandMark />
            <span className="auth-aside-label">A wider world starts with a word</span>
          </div>
          <div className="auth-aside-message">
            <span className="auth-eyebrow">LANGUAGE OPENS DOORS</span>
            <h2>Make room for a new way to see the world.</h2>
            <p>
              Build a steady practice, one thoughtful step at a time. Your
              learning journey starts here.
            </p>
            <div className="auth-orbit" aria-hidden="true">
              <span className="auth-orbit-dot auth-orbit-dot-one" />
              <span className="auth-orbit-dot auth-orbit-dot-two" />
              <span className="auth-orbit-dot auth-orbit-dot-three" />
              <span className="auth-orbit-core">Aa</span>
            </div>
          </div>
          <p className="auth-aside-footnote">Thoughtfully designed for curious minds.</p>
        </aside>

        <section className="auth-content" aria-labelledby="auth-title">
          <div className="auth-toolbar">
            <Link className="auth-back-link" href="/">Back to LingoPro</Link>
            <ThemeSwitcher />
          </div>
          <FadeUp className="auth-card">
            {eyebrow && <p className="auth-eyebrow auth-content-eyebrow">{eyebrow}</p>}
            <h1 id="auth-title">{title}</h1>
            {description && <p className="auth-description">{description}</p>}
            {notice}
            {children}
            {footer && <div className="auth-footer">{footer}</div>}
          </FadeUp>
        </section>
      </div>
    </main>
  );
}
