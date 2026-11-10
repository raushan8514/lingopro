"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpenText, Headphones, Layers3 } from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import ActionLink from "@/components/landing/action-link";
import SectionHeading from "@/components/landing/section-heading";
import { courseCategories, coursePreviews } from "@/lib/landing-content";

export default function CoursePreview() {
  const [activeCategory, setActiveCategory] = useState("all");
  const visiblePreviews = useMemo(
    () =>
      activeCategory === "all"
        ? coursePreviews
        : coursePreviews.filter((course) => course.category === activeCategory),
    [activeCategory],
  );

  return (
    <section className="landing-section course-section" id="courses" aria-labelledby="courses-title">
      <div className="landing-container">
        <div className="course-heading-row">
          <SectionHeading
            id="courses-title"
            eyebrow="A glimpse of what is possible"
            title="Learning that fits real life."
            description="A visual preview of possible learning formats. These examples are not published courses and are not connected to a course catalog."
          />
          <ActionLink href="#explore" variant="outline" rightIcon={<ArrowRight size={15} />}>
            Explore languages
          </ActionLink>
        </div>
        <div className="course-categories" role="group" aria-label="Filter illustrative course previews">
          {courseCategories.map((category) => (
            <Button
              key={category.id}
              size="sm"
              variant={activeCategory === category.id ? "secondary" : "ghost"}
              aria-pressed={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </Button>
          ))}
        </div>
        <ScrollStagger className="course-grid" aria-live="polite">
          {visiblePreviews.map((course) => (
            <ScrollStaggerItem key={course.id}>
              <Card className="course-card" hover>
                <div className={`course-art ${course.artwork}`} aria-hidden="true">
                  <span className="course-art-orb" />
                  <span className="course-art-mark">{course.monogram}</span>
                  <span className="course-art-caption">{course.language} / LEARNING CONCEPT</span>
                </div>
                <CardContent>
                  <div className="course-card-topline">
                    <Badge variant="information">{course.language}</Badge>
                    <span className="course-preview-label">Preview</span>
                  </div>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <div className="course-meta">
                    <span><Layers3 size={14} /> {course.level}</span>
                    <span>
                      {course.format.includes("Audio") ? <Headphones size={14} /> : <BookOpenText size={14} />}
                      {course.format}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </ScrollStaggerItem>
          ))}
        </ScrollStagger>
        <p className="section-footnote">
          <span className="footnote-mark" aria-hidden="true">i</span>
          Illustrative examples only. Course availability, curriculum, and access details are not yet published.
        </p>
      </div>
    </section>
  );
}
