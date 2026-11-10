"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReducedMotionPreference } from "@/components/shared/animations";
import SectionHeading from "@/components/landing/section-heading";
import { frequentlyAskedQuestions } from "@/lib/landing-content";

export default function FAQ() {
  const [openQuestion, setOpenQuestion] = useState(frequentlyAskedQuestions[0].id);
  const reduceMotion = useReducedMotionPreference();

  return (
    <section className="landing-section faq-section" id="faq" aria-labelledby="faq-title">
      <div className="landing-container faq-layout">
        <div className="faq-intro">
          <SectionHeading
            id="faq-title"
            eyebrow="Good questions"
            title="A few things to know."
            description="We are building LingoPro thoughtfully. Here is what is and is not available today."
          />
        </div>
        <div className="faq-list">
          {frequentlyAskedQuestions.map((item, index) => {
            const expanded = openQuestion === item.id;
            const panelId = `faq-answer-${item.id}`;

            return (
              <article className={`faq-item${expanded ? " is-open" : ""}`} key={item.id}>
                <h3>
                  <button
                    className="faq-trigger"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenQuestion(expanded ? null : item.id)}
                  >
                    <span className="faq-number">0{index + 1}</span>
                    <span>{item.question}</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={panelId}
                      className="faq-answer-wrap"
                      role="region"
                      aria-label={item.question}
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
