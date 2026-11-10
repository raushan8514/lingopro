import { ArrowRight, Languages, Sparkles } from "lucide-react";
import ActionLink from "@/components/landing/action-link";

export default function FinalCTA() {
  return (
    <section className="landing-final-cta" aria-labelledby="final-cta-title">
      <div className="landing-container final-cta-inner">
        <span className="final-cta-mark" aria-hidden="true"><Languages size={21} /></span>
        <span className="landing-eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER</span>
        <h2 id="final-cta-title">A new language can take you anywhere.</h2>
        <p>Find a place to begin and imagine where the next word could lead.</p>
        <ActionLink href="#explore" size="lg" variant="secondary" rightIcon={<ArrowRight size={17} />}>
          Explore language concepts
        </ActionLink>
        <span className="final-cta-disclaimer">Illustrative experience preview · No enrollment is available yet</span>
      </div>
    </section>
  );
}
