import { Quote } from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { Card, CardContent } from "@/components/ui";
import SectionHeading from "@/components/landing/section-heading";
import { sampleTestimonials } from "@/lib/landing-content";

export default function Testimonials() {
  return (
    <section className="landing-section testimonials-section" aria-labelledby="testimonials-title">
      <div className="landing-container">
        <div className="testimonial-heading">
          <SectionHeading
            id="testimonials-title"
            eyebrow="A learning philosophy"
            title="Language makes the world feel closer."
            description="These sample lines express the spirit behind LingoPro. They are not customer reviews or endorsements."
          />
          <span className="testimonial-large-quote" aria-hidden="true">“</span>
        </div>
        <ScrollStagger className="testimonial-grid">
          {sampleTestimonials.map((testimonial) => (
            <ScrollStaggerItem key={testimonial.attribution}>
              <Card className="testimonial-card">
                <CardContent>
                  <Quote size={17} className="testimonial-quote-icon" aria-hidden="true" />
                  <blockquote>{testimonial.quote}</blockquote>
                  <div className="testimonial-source">
                    <span className="testimonial-avatar" aria-hidden="true">L</span>
                    <span>
                      <strong>{testimonial.attribution}</strong>
                      <small>{testimonial.context}</small>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </ScrollStaggerItem>
          ))}
        </ScrollStagger>
      </div>
    </section>
  );
}
