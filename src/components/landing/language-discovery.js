"use client";

import { useState } from "react";
import { ArrowRight, Check, Compass } from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { Button } from "@/components/ui";
import ActionLink from "@/components/landing/action-link";
import SectionHeading from "@/components/landing/section-heading";
import { languages, learningLevels } from "@/lib/landing-content";

export default function LanguageDiscovery() {
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState("starting");
  const currentLanguage = languages.find((language) => language.id === selectedLanguage);

  return (
    <section className="landing-section explore-section" id="explore" aria-labelledby="explore-title">
      <div className="landing-container">
        <div className="explore-topline">
          <SectionHeading
            id="explore-title"
            eyebrow="A place to begin"
            title="Where would you like to go?"
            description="Choose a language to explore. These are illustrative options, not published courses or enrollment availability."
          />
          <span className="explore-index"><Compass size={15} /> 07 LANGUAGE CONCEPTS</span>
        </div>
        <ScrollStagger
          className="language-grid"
          role="group"
          aria-label="Illustrative language options"
        >
          {languages.map((language) => {
            const selected = selectedLanguage === language.id;

            return (
              <ScrollStaggerItem key={language.id}>
                <button
                  type="button"
                  className={`language-option${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedLanguage(language.id)}
                >
                  <span className={`language-glyph glyph-${language.id}`} aria-hidden="true">
                    {language.symbol}
                  </span>
                  <span className="language-option-copy">
                    <strong>{language.name}</strong>
                    <small>{language.note}</small>
                  </span>
                  <span className="language-option-check" aria-hidden="true">
                    {selected && <Check size={14} />}
                  </span>
                </button>
              </ScrollStaggerItem>
            );
          })}
        </ScrollStagger>
        <div className="language-explore-footer">
          <div className="language-level">
            <span className="language-level-label">A place to start</span>
            <div className="language-level-options" role="group" aria-label="Illustrative learning starting point">
              {learningLevels.map((level) => (
                <Button
                  key={level.id}
                  type="button"
                  size="sm"
                  variant={selectedLevel === level.id ? "secondary" : "ghost"}
                  aria-pressed={selectedLevel === level.id}
                  onClick={() => setSelectedLevel(level.id)}
                >
                  {level.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="language-selection-action">
            <p aria-live="polite">
              {currentLanguage
                ? `${currentLanguage.name} selected for this preview.`
                : "Pick a language to see it selected."}
            </p>
            <ActionLink href="#how-it-works" size="sm" rightIcon={<ArrowRight size={15} />}>
              See how learning works
            </ActionLink>
          </div>
        </div>
      </div>
    </section>
  );
}
