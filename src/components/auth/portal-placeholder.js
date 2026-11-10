import Link from "next/link";
import BrandMark from "@/components/shared/brand-mark";

const portalCopy = {
  student: {
    title: "Your learning space is being prepared.",
    description:
      "Your account is secure. Student onboarding and learning tools will arrive in a later phase.",
  },
  instructor: {
    title: "Your instructor space is being prepared.",
    description:
      "Your instructor access is verified. Teaching tools will arrive in a later phase.",
  },
  admin: {
    title: "Your administration space is being prepared.",
    description:
      "Your administrator access is verified. Platform operations will arrive in a later phase.",
  },
};

export default function PortalPlaceholder({ role }) {
  const copy = portalCopy[role];

  return (
    <main className="portal-placeholder">
      <header className="portal-placeholder-header">
        <BrandMark />
        <span className="portal-role-badge">{role} portal</span>
      </header>
      <section className="portal-placeholder-card">
        <span className="auth-eyebrow">ACCOUNT ACCESS VERIFIED</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <Link className="portal-home-link" href="/">Return to LingoPro</Link>
      </section>
    </main>
  );
}
