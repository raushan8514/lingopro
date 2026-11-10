import {
  ArrowUpRight,
  AudioLines,
  Check,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { ScrollReveal } from "@/components/shared/animations";
import { Badge } from "@/components/ui";
import SectionHeading from "@/components/landing/section-heading";

const sampleMessages = [
  {
    speaker: "learner",
    label: "YOU · SAMPLE",
    text: "Ayer yo voy al mercado.",
  },
  {
    speaker: "tutor",
    label: "TUTOR CONCEPT · SAMPLE",
    text: "Almost! For yesterday, try the past tense: Ayer fui al mercado.",
  },
];

export default function TutorPreview() {
  return (
    <section className="landing-section tutor-section" id="tutor" aria-labelledby="tutor-title">
      <div className="landing-container tutor-layout">
        <ScrollReveal className="tutor-copy" variant="fadeUp">
          <SectionHeading
            id="tutor-title"
            eyebrow="A conversation, thoughtfully guided"
            title="Practice without pressure."
            description="A future tutor concept for trying a phrase, noticing a grammar pattern, and finding a new word in context."
          />
          <ul className="tutor-benefits">
            <li><span><Check size={14} /></span> Gentle grammar suggestions</li>
            <li><span><Check size={14} /></span> Useful words for the moment</li>
            <li><span><Check size={14} /></span> Room to try again, your way</li>
          </ul>
          <Badge variant="warning">
            <Sparkles size={13} aria-hidden="true" />
            Concept preview · Not an active AI service
          </Badge>
        </ScrollReveal>
        <ScrollReveal className="tutor-window-wrap" variant="scaleIn" delay={0.08}>
          <div className="tutor-window">
            <div className="tutor-window-header">
              <span className="tutor-window-icon"><MessageCircle size={17} /></span>
              <div>
                <strong>Practice conversation</strong>
                <small>Spanish · sample interface</small>
              </div>
              <span className="tutor-window-menu" aria-hidden="true"><ArrowUpRight size={17} /></span>
            </div>
            <div className="tutor-window-context">
              <span>IN THE MOMENT</span>
              <strong>Talking about yesterday</strong>
            </div>
            <div className="tutor-messages">
              {sampleMessages.map((message) => (
                <div className={`tutor-message is-${message.speaker}`} key={message.label}>
                  <span>{message.label}</span>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <div className="tutor-word-note">
              <span className="tutor-word-icon"><AudioLines size={16} /></span>
              <span><small>A WORD TO KEEP</small><strong>fui <em>· I went</em></strong></span>
              <span className="tutor-word-check"><Check size={14} /></span>
            </div>
            <div className="tutor-feedback">
              <Sparkles size={14} />
              <span>Notice how <strong>fui</strong> carries the action into the past.</span>
            </div>
            <div className="tutor-composer" aria-hidden="true">
              <span>Conversation input preview</span>
              <span className="tutor-composer-action"><ArrowUpRight size={15} /></span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
