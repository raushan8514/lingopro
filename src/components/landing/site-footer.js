import { ArrowUpRight } from "lucide-react";
import BrandMark from "@/components/shared/brand-mark";

const homepageFooterLinks = [
  { label: "Explore languages", href: "#explore" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing concepts", href: "#pricing" },
  { label: "Questions", href: "#faq" },
];

const marketplaceFooterLinks = [
  { label: "Explore courses", href: "/courses" },
  { label: "Browse categories", href: "/categories" },
  { label: "Create a student account", href: "/register" },
  { label: "Log in", href: "/login" },
];

export default function SiteFooter({ marketplace = false }) {
  const footerLinks = marketplace ? marketplaceFooterLinks : homepageFooterLinks;

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
            <BrandMark />
            <p>A thoughtful way to make room for a new perspective.</p>
          </div>
          <nav className="landing-footer-nav" aria-label="Footer navigation">
            {footerLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}<ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ))}
          </nav>
          <div className="landing-footer-note">
            <span className="footer-note-dot" aria-hidden="true" />
            <span>Early product concept<br />Features and plans are not yet available.</span>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© LingoPro</span>
          <span>Built for the words that bring us closer.</span>
          <a href={marketplace ? "#main-content" : "#home"}>Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
