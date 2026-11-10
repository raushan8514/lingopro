import {
  Award,
  BarChart3,
  BookOpenText,
  Check,
  CircleHelp,
  Clock3,
  FileBadge2,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { ScrollStagger, ScrollStaggerItem } from "@/components/shared/animations";
import { Badge, Card, CardContent, Progress } from "@/components/ui";
import SectionHeading from "@/components/landing/section-heading";

const chartHeights = [32, 46, 39, 62, 53, 78, 70, 91];

export default function ProductPreviews() {
  return (
    <section className="landing-section previews-section" id="product-preview" aria-labelledby="previews-title">
      <div className="landing-container">
        <SectionHeading
          id="previews-title"
          eyebrow="A look at the product direction"
          title="Learning, made visible."
          description="A few visual previews of the experiences LingoPro is working toward. These screens are illustrative only—not real dashboards, learner records, or active course content."
        />
        <ScrollStagger className="product-preview-grid">
          <ScrollStaggerItem>
            <Card className="product-preview-card">
              <CardContent>
                <PreviewLabel icon={BookOpenText} label="LESSON SPACE · PREVIEW" />
                <div className="preview-dashboard">
                  <div className="preview-dash-top">
                    <span className="preview-avatar">L</span>
                    <span className="preview-lines"><i /><i /></span>
                    <span className="preview-dash-menu"><i /><i /><i /></span>
                  </div>
                  <div className="preview-dash-title"><i /><i /></div>
                  <div className="preview-lesson-list">
                    <span><b>01</b><i /><Check size={13} /></span>
                    <span><b>02</b><i /><span className="preview-dot" /></span>
                    <span><b>03</b><i /><span className="preview-dot is-muted" /></span>
                  </div>
                </div>
                <h3>A focused lesson space</h3>
                <p>A possible view for keeping a learning path easy to follow.</p>
              </CardContent>
            </Card>
          </ScrollStaggerItem>

          <ScrollStaggerItem>
            <Card className="product-preview-card">
              <CardContent>
                <PreviewLabel icon={ListChecks} label="KNOWLEDGE CHECK · PREVIEW" />
                <div className="preview-quiz">
                  <div className="preview-quiz-progress"><span /></div>
                  <span className="preview-quiz-kicker">QUICK PRACTICE</span>
                  <strong>Which phrase means<br />“take your time”?</strong>
                  <span className="preview-answer is-selected"><i>con calma</i><Check size={13} /></span>
                  <span className="preview-answer"><i>hasta luego</i></span>
                  <span className="preview-answer"><i>por supuesto</i></span>
                </div>
                <h3>Practice that invites recall</h3>
                <p>A sample quiz layout—not a live assessment or score.</p>
              </CardContent>
            </Card>
          </ScrollStaggerItem>

          <ScrollStaggerItem>
            <Card className="product-preview-card">
              <CardContent>
                <PreviewLabel icon={BarChart3} label="LEARNING RHYTHM · PREVIEW" />
                <div className="preview-analytics">
                  <div className="preview-analytics-copy">
                    <span>YOUR PRACTICE</span>
                    <strong>A little, often.</strong>
                  </div>
                  <span className="preview-analytics-chart" aria-hidden="true">
                    {chartHeights.map((height, index) => (
                      <i key={index} style={{ "--bar-height": `${height}%` }} />
                    ))}
                  </span>
                  <Progress value={58} label="Sample progress indicator" showValue />
                </div>
                <h3>Progress without pressure</h3>
                <p>Illustrative visualization with no real learner data.</p>
              </CardContent>
            </Card>
          </ScrollStaggerItem>

          <ScrollStaggerItem>
            <Card className="product-preview-card">
              <CardContent>
                <PreviewLabel icon={Award} label="MILESTONE · PREVIEW" />
                <div className="preview-certificate">
                  <span className="preview-certificate-border">
                    <span className="preview-certificate-icon"><FileBadge2 size={26} /></span>
                    <small>A MOMENT TO MARK</small>
                    <strong>Learning<br />milestone</strong>
                    <span className="preview-certificate-rule" />
                    <span className="preview-certificate-brand">LINGOPRO · CONCEPT</span>
                  </span>
                  <span className="preview-certificate-spark"><Sparkles size={17} /></span>
                </div>
                <h3>Celebrate the work</h3>
                <p>A certificate-style visual concept; no credential is issued.</p>
              </CardContent>
            </Card>
          </ScrollStaggerItem>
        </ScrollStagger>
        <div className="preview-disclaimer">
          <CircleHelp size={15} aria-hidden="true" />
          <span>Interface concepts only. No student accounts, statistics, assessments, or credentials are represented.</span>
          <Clock3 size={15} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function PreviewLabel({ icon: Icon, label }) {
  return (
    <div className="preview-label">
      <span><Icon size={15} aria-hidden="true" /> {label}</span>
      <Badge>Concept</Badge>
    </div>
  );
}
