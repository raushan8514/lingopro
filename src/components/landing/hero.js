import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Check,
  CirclePlay,
  Languages,
  Sparkles,
} from "lucide-react";
import {
  FadeUp,
  HoverLift,
  ScrollReveal,
} from "@/components/shared/animations";
import { Badge, Progress } from "@/components/ui";
import ActionLink from "@/components/landing/action-link";

const practiceWords = [
  { original: "la sobremesa", translation: "time spent talking after a meal" },
  { original: "con calma", translation: "without rushing" },
];

export default function Hero() {
  return (
    <section className="landing-hero" id="home" aria-labelledby="hero-title">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <FadeUp className="landing-hero-kicker">
            <span className="landing-kicker-icon"><Sparkles size={14} /></span>
            LANGUAGE LEARNING, WITH ROOM TO GROW
          </FadeUp>
          <FadeUp as="div">
            <h1 id="hero-title">
              Speak a new language.
              <span>Discover a new world.</span>
            </h1>
          </FadeUp>
          <FadeUp>
            <p className="landing-hero-description">
              Build real-world language skills through interactive lessons,
              personalized practice and measurable progress.
            </p>
          </FadeUp>
          <FadeUp className="landing-hero-actions">
            <ActionLink href="#explore" size="lg" rightIcon={<ArrowRight size={17} />}>
              Explore learning
            </ActionLink>
            <ActionLink
              href="#how-it-works"
              size="lg"
              variant="ghost"
              leftIcon={<CirclePlay size={18} />}
              className="landing-hero-secondary"
            >
              Discover how it works
            </ActionLink>
          </FadeUp>
          <div className="landing-hero-note">
            <span className="landing-avatar-stack" aria-hidden="true">
              <span>A</span><span>語</span><span>ñ</span>
            </span>
            <span>A more thoughtful way to make progress.</span>
          </div>
        </div>

        <ScrollReveal className="hero-art-wrap" variant="scaleIn">
          <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
          <div className="hero-art-glow" aria-hidden="true" />
          <div className="hero-sticker hero-sticker-top" aria-hidden="true">
            <Languages size={17} />
            <span>Words in context</span>
          </div>
          <div className="hero-sticker hero-sticker-bottom" aria-hidden="true">
            <span className="hero-sticker-check"><Check size={13} /></span>
            <span>One phrase at a time</span>
          </div>
          <HoverLift className="hero-learning-card">
            <div className="hero-card-top">
              <div>
                <span className="hero-card-overline">A LEARNING MOMENT</span>
                <h2>Make it meaningful.</h2>
              </div>
              <span className="hero-language-mark" aria-label="Spanish preview">ES</span>
            </div>
            <div className="hero-scene">
              <div className="hero-sun" />
              <div className="hero-scene-window">
                <span className="hero-window-arch" />
                <span className="hero-window-line hero-window-line-one" />
                <span className="hero-window-line hero-window-line-two" />
                <span className="hero-window-plant" />
              </div>
              <span className="hero-scene-dot hero-scene-dot-one" />
              <span className="hero-scene-dot hero-scene-dot-two" />
              <span className="hero-scene-caption">A QUIET MOMENT, IN SPANISH</span>
            </div>
            <div className="hero-vocabulary">
              <div className="hero-vocabulary-heading">
                <span>WORDS TO KEEP</span>
                <AudioLines size={16} aria-hidden="true" />
              </div>
              {practiceWords.map((word) => (
                <div className="hero-word-row" key={word.original}>
                  <span>{word.original}</span>
                  <small>{word.translation}</small>
                </div>
              ))}
            </div>
            <div className="hero-progress">
              <div className="hero-progress-heading">
                <span>Practice preview</span>
                <Badge variant="success">Illustrative</Badge>
              </div>
              <Progress value={64} label="A sample learning path" showValue />
            </div>
          </HoverLift>
          <div className="hero-floating-note">
            <span className="hero-sparkle"><Sparkles size={15} /></span>
            <span><strong>Listen.</strong> Notice. Remember.</span>
          </div>
        </ScrollReveal>
      </div>
      <a className="landing-scroll-cue" href="#explore">
        <span>Find your next language</span>
        <ArrowDown size={15} aria-hidden="true" />
      </a>
    </section>
  );
}
