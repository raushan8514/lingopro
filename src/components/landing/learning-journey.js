import {
  Award,
  BookOpenText,
  ChartNoAxesCombined,
  Compass,
  Languages,
  ListChecks,
} from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import SectionHeading from "@/components/landing/section-heading";
import { learningSteps } from "@/lib/landing-content";

const stepIcons = {
  Languages,
  Compass,
  BookOpenText,
  ListChecks,
  ChartNoAxesCombined,
  Award,
};

export default function LearningJourney() {
  return (
    <section className="landing-section journey-section" id="how-it-works" aria-labelledby="journey-title">
      <div className="landing-container journey-layout">
        <div className="journey-intro">
          <SectionHeading
            id="journey-title"
            eyebrow="A path with purpose"
            title="Small steps. A bigger world."
            description="A clear learning rhythm can turn curiosity into confidence—one useful moment at a time."
          />
          <div className="journey-note">
            <span className="journey-note-icon"><Languages size={18} /></span>
            <p><strong>Made for steady progress.</strong><br />Take the next step when you are ready.</p>
          </div>
        </div>
        <ScrollStagger className="journey-steps">
          {learningSteps.map((step) => {
            const Icon = stepIcons[step.icon];

            return (
              <ScrollStaggerItem key={step.number}>
                <article className="journey-step">
                  <span className="journey-step-number">{step.number}</span>
                  <span className="journey-step-icon">
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </article>
              </ScrollStaggerItem>
            );
          })}
        </ScrollStagger>
      </div>
    </section>
  );
}
