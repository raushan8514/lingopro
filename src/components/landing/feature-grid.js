import {
  AudioLines,
  Award,
  BookOpenText,
  ChartNoAxesCombined,
  ListChecks,
  MessagesSquare,
  PanelsTopLeft,
  Route,
} from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { Card, CardContent } from "@/components/ui";
import SectionHeading from "@/components/landing/section-heading";
import { features } from "@/lib/landing-content";

const featureIcons = {
  BookOpenText,
  Route,
  MessagesSquare,
  ListChecks,
  ChartNoAxesCombined,
  Award,
  AudioLines,
  PanelsTopLeft,
};

export default function FeatureGrid() {
  return (
    <section className="landing-section features-section" id="features" aria-labelledby="features-title">
      <div className="landing-container">
        <SectionHeading
          id="features-title"
          eyebrow="Designed around real learning"
          title="A thoughtful toolkit for the way you learn."
          description="LingoPro brings focused practice and a sense of direction into one considered experience. These are product capabilities in development."
        />
        <ScrollStagger className="feature-grid">
          {features.map((feature) => {
            const Icon = featureIcons[feature.icon];

            return (
              <ScrollStaggerItem key={feature.id}>
                <Card className="feature-card" hover>
                  <CardContent>
                    <span className={`feature-icon feature-icon-${feature.tone}`}>
                      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </CardContent>
                </Card>
              </ScrollStaggerItem>
            );
          })}
        </ScrollStagger>
        <p className="section-footnote">
          <span className="footnote-mark" aria-hidden="true">i</span>
          Product capabilities shown are part of the LingoPro roadmap and are not live yet.
        </p>
      </div>
    </section>
  );
}
