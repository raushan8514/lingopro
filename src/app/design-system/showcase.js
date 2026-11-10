"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  CreditCard,
  Ellipsis,
  Globe2,
  Languages,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import BrandMark from "@/components/shared/brand-mark";
import {
  FadeIn,
  FadeUp,
  HoverLift,
  ScaleIn,
  StaggerContainer,
  StaggerItem,
  TapScale,
} from "@/components/shared/animations";
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DropdownMenu,
  EmptyState,
  Input,
  Progress,
  Select,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemeSwitcher,
  Tooltip,
} from "@/components/ui";

const sections = [
  ["foundations", "Foundations"],
  ["typography", "Typography"],
  ["buttons", "Buttons"],
  ["forms", "Form controls"],
  ["surfaces", "Cards & badges"],
  ["indicators", "Indicators"],
  ["feedback", "Feedback"],
  ["navigation", "Navigation"],
  ["motion", "Motion"],
];

const colorTokens = [
  ["Background", "--background"],
  ["Foreground", "--foreground"],
  ["Card", "--card"],
  ["Card foreground", "--card-foreground"],
  ["Primary", "--primary"],
  ["Primary foreground", "--primary-foreground"],
  ["Secondary", "--secondary"],
  ["Secondary foreground", "--secondary-foreground"],
  ["Muted", "--muted"],
  ["Muted foreground", "--muted-foreground"],
  ["Accent", "--accent"],
  ["Accent foreground", "--accent-foreground"],
  ["Border", "--border"],
  ["Input", "--input"],
  ["Focus ring", "--ring"],
  ["Success", "--success"],
  ["Success foreground", "--success-foreground"],
  ["Warning", "--warning"],
  ["Warning foreground", "--warning-foreground"],
  ["Destructive", "--destructive"],
  ["Destructive foreground", "--destructive-foreground"],
  ["Information", "--information"],
  ["Information foreground", "--information-foreground"],
];

export default function DesignSystemShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [menuMessage, setMenuMessage] = useState("Choose an action to preview it.");

  function previewLoading() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1200);
  }

  const menuItems = [
    { label: "Edit details", icon: Pencil, onSelect: () => setMenuMessage("Edit details selected.") },
    { label: "Copy reference", icon: Ellipsis, onSelect: () => setMenuMessage("Reference copied in this preview.") },
    { separator: true },
    { label: "Remove item", icon: Trash2, destructive: true, onSelect: () => setMenuMessage("Remove action previewed.") },
  ];

  return (
    <main className="ds-page">
      <header className="ds-topbar">
        <div className="ds-topbar-start">
          <Link className="ds-back-link" href="/">
            <ArrowLeft size={17} aria-hidden="true" />
            <span className="ds-back-label">Back to home</span>
          </Link>
          <span className="ds-divider" aria-hidden="true" />
          <BrandMark />
          <span className="ds-divider" aria-hidden="true" />
          <div className="ds-title-lockup">
            <strong>Design system</strong>
            <span>Internal reference</span>
          </div>
        </div>
        <div className="ds-topbar-end">
          <ThemeSwitcher />
        </div>
      </header>

      <div className="ds-layout">
        <aside className="ds-sidebar">
          <p className="ds-sidebar-title">On this page</p>
          <nav aria-label="Design system sections">
            {sections.map(([id, label]) => (
              <a href={`#${id}`} key={id}>{label}</a>
            ))}
          </nav>
        </aside>

        <div className="ds-content">
          <section className="ds-intro">
            <p className="ds-kicker">
              <Sparkles size={14} aria-hidden="true" />
              LingoPro foundations
            </p>
            <h1>Clarity in every detail.</h1>
            <p>
              A shared visual language for thoughtful learning experiences.
              Explore semantic color, type, motion, and accessible interface
              components in light, dark, or system theme.
            </p>
          </section>

          <section className="ds-section" id="foundations">
            <SectionHeading
              title="Color foundations"
              description="Semantic tokens adapt automatically to the selected theme. Components should use these names, not one-off color values."
            />
            <div className="ds-swatch-grid">
              {colorTokens.map(([label, token]) => (
                <div className="ds-swatch" key={token}>
                  <span
                    className="ds-swatch-color"
                    style={{ "--swatch-color": `var(${token})` }}
                    aria-hidden="true"
                  />
                  <span className="ds-swatch-label">
                    <strong>{label}</strong>
                    <span>{token}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="ds-stack" style={{ marginTop: "1rem" }}>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Destructive</Badge>
              <Badge variant="information">Information</Badge>
              <Badge>Neutral</Badge>
            </div>
          </section>

          <section className="ds-section" id="typography">
            <SectionHeading
              title="Typography"
              description="Geist Sans carries the interface with compact labels, readable body copy, and a confident display scale."
            />
            <div className="ds-type-list">
              <TypeRow name="Display / 01">
                <span className="ds-type-display-sample">A wider world</span>
              </TypeRow>
              <TypeRow name="Page heading">
                <span className="ds-type-page-sample">Learning, in your own words.</span>
              </TypeRow>
              <TypeRow name="Section heading">
                <span className="ds-type-section-sample">Build a daily practice</span>
              </TypeRow>
              <TypeRow name="Body">
                <span className="ds-type-body-sample">Small, consistent steps make a new language feel closer.</span>
              </TypeRow>
              <TypeRow name="Supporting">
                <span className="ds-type-supporting-sample">A little context helps you find your next lesson.</span>
              </TypeRow>
              <TypeRow name="Label">
                <span className="ds-type-label-sample">COURSE OVERVIEW</span>
              </TypeRow>
              <TypeRow name="Metadata">
                <span className="ds-type-meta-sample">Updated just now | 12 min read</span>
              </TypeRow>
            </div>
          </section>

          <section className="ds-section" id="buttons">
            <SectionHeading
              title="Buttons"
              description="Clear hierarchy, consistent touch targets, and explicit loading and disabled states."
            />
            <div className="ds-stack">
              <Button leftIcon={<BookOpen size={16} />}>Primary action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive" leftIcon={<Trash2 size={15} />}>Destructive</Button>
            </div>
            <div className="ds-stack" style={{ marginTop: "0.85rem" }}>
              <Button size="sm">Small</Button>
              <Button size="md">Default</Button>
              <Button size="lg" rightIcon={<ArrowRight size={16} />}>Large</Button>
              <Button size="icon" variant="outline" aria-label="Search">
                <Search size={17} />
              </Button>
              <Button loading={loading} onClick={previewLoading}>
                {loading ? "Saving..." : "Preview loading"}
              </Button>
              <Button disabled variant="outline">Disabled</Button>
            </div>
          </section>

          <section className="ds-section" id="forms">
            <SectionHeading
              title="Form controls"
              description="Labels, hints, validation, and native keyboard behavior are part of each control."
            />
            <div className="ds-form-grid">
              <Input label="Email address" type="email" placeholder="you@example.com" hint="Use the address associated with your learning account." />
              <Input label="Validation state" type="email" placeholder="name@example.com" error="Enter a valid email address." />
              <Input label="Disabled input" value="This field is read-only" disabled readOnly />
              <Select label="Learning level" defaultValue="intermediate">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
              <Textarea label="Short introduction" placeholder="Tell us what you hope to learn..." rows={3} />
              <div className="layout-stack layout-gap-sm">
                <Checkbox label="Send me useful learning reminders" description="You can change this preference any time." defaultChecked />
                <Switch
                  label="Weekly progress summary"
                  description="A brief recap of your learning week."
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
              </div>
            </div>
          </section>

          <section className="ds-section" id="surfaces">
            <SectionHeading
              title="Cards, badges & avatars"
              description="Quiet surfaces, restrained borders, and small status accents create structure without visual noise."
            />
            <div className="ds-grid-two">
              <Card hover className="ds-card-sample">
                <CardHeader>
                  <div className="ds-card-meta">
                    <span className="ui-empty-icon"><Languages size={18} aria-hidden="true" /></span>
                    <Badge variant="success">In progress</Badge>
                  </div>
                  <CardTitle>French foundations</CardTitle>
                  <CardDescription>A steady path through useful everyday conversations.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={64} label="Course progress" showValue />
                </CardContent>
                <CardFooter>
                  <span className="ds-mono-note">12 lessons | Beginner</span>
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight size={15} />}>Open</Button>
                </CardFooter>
              </Card>
              <div className="layout-stack layout-gap-md">
                <div className="ds-avatar-row">
                  <Avatar name="Maya Chen" size="sm" />
                  <Avatar name="Maya Chen" />
                  <Avatar name="Maya Chen" size="lg" />
                  <span className="ds-mono-note">Initials fallback</span>
                </div>
                <div className="ds-stack">
                  <Badge variant="success"><Check size={12} /> Complete</Badge>
                  <Badge variant="warning">Needs review</Badge>
                  <Badge variant="error">Action required</Badge>
                  <Badge variant="information">New lesson</Badge>
                  <Badge>Draft</Badge>
                </div>
                <Alert variant="success" title="Progress saved">
                  Your lesson progress is up to date.
                </Alert>
              </div>
            </div>
          </section>

          <section className="ds-section" id="indicators">
            <SectionHeading
              title="Progress & loading"
              description="Progress bars expose their value to assistive technology; skeletons and spinners indicate loading without shifting layout."
            />
            <div className="ds-grid-two">
              <div className="ds-progress-sample">
                <Progress value={72} label="Weekly practice" showValue />
                <Progress value={38} label="Course completion" showValue />
                <div className="ds-avatar-row">
                  <Spinner label="Loading lesson" />
                  <span className="ds-mono-note">Loading lesson content</span>
                </div>
              </div>
              <div className="ds-skeleton-sample" aria-label="Lesson card loading preview" aria-busy="true">
                <Skeleton style={{ width: "38%", height: "0.65rem" }} />
                <Skeleton className="ds-skeleton-line" />
                <Skeleton className="ds-skeleton-line ds-skeleton-line-short" />
                <Skeleton style={{ width: "100%", height: "0.4rem", marginTop: "0.4rem" }} />
              </div>
            </div>
          </section>

          <section className="ds-section" id="feedback">
            <SectionHeading
              title="Feedback & overlays"
              description="Messages, tooltips, dropdowns, and dialogs are operable by keyboard and sized for narrow screens."
            />
            <div className="layout-stack layout-gap-sm">
              <Alert variant="information" title="A small tip">
                Short practice sessions are easier to keep consistent.
              </Alert>
              <Alert variant="warning" title="Check your connection">
                The lesson content may take a little longer to load.
              </Alert>
              <Alert variant="error" title="We could not save this change">
                Please try again when you are ready.
              </Alert>
            </div>
            <div className="ds-stack" style={{ marginTop: "1rem" }}>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>Open dialog</Button>
              <DropdownMenu
                label="Open component actions"
                trigger={<><MoreHorizontal size={17} /> Actions</>}
                items={menuItems}
              />
              <Tooltip content="A little context, right where you need it.">
                <Button variant="ghost" size="icon" aria-label="About this control">
                  <CircleHelp size={17} />
                </Button>
              </Tooltip>
              <span className="ds-mono-note" aria-live="polite">{menuMessage}</span>
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="A focused dialog"
              description="Native dialog behavior keeps focus inside while open and returns it when dismissed."
              footer={
                <>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)}>Done</Button>
                </>
              }
            >
              Use Escape, the close control, or the actions below to dismiss. The
              page behind this panel remains inert until the dialog closes.
            </Dialog>
          </section>

          <section className="ds-section" id="navigation">
            <SectionHeading
              title="Navigation"
              description="Small building blocks for wayfinding, tabbed content, and future app navigation."
            />
            <div className="layout-stack layout-gap-md">
              <Breadcrumb
                items={[
                  { label: "Library", href: "/" },
                  { label: "Languages", href: "/design-system" },
                  { label: "French foundations" },
                ]}
              />
              <Tabs defaultValue="overview">
                <TabsList label="Course sections">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="lessons">Lessons</TabsTrigger>
                  <TabsTrigger value="resources" disabled>Resources</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  A calm overview keeps the most useful context close at hand.
                </TabsContent>
                <TabsContent value="lessons">
                  Lesson lists can use the same accessible, keyboard-friendly tabs.
                </TabsContent>
                <TabsContent value="resources">
                  Course resources appear here when available.
                </TabsContent>
              </Tabs>
              <Separator />
              <div className="ds-stack">
                <a className="layout-navigation-link is-active" href="#navigation">
                  <LayoutDashboard size={17} aria-hidden="true" /> Overview
                </a>
                <a className="layout-navigation-link" href="#forms">
                  <BookOpen size={17} aria-hidden="true" /> Learning
                </a>
                <a className="layout-navigation-link" href="#feedback">
                  <Bell size={17} aria-hidden="true" /> Updates
                </a>
                <a className="layout-navigation-link" href="#foundations">
                  <CreditCard size={17} aria-hidden="true" /> Plan
                </a>
              </div>
              <EmptyState
                icon={Globe2}
                title="Your next language is waiting"
                description="This reusable state helps explain an empty view and what someone can do next."
                action={<Button variant="outline" size="sm">Explore languages</Button>}
              />
              <div className="ds-empty-wrap">
                <EmptyState
                  icon={Command}
                  title="No saved shortcuts"
                  description="A short, helpful explanation belongs next to a clear next step."
                  action={<Button variant="ghost" size="sm">Browse lessons</Button>}
                />
              </div>
            </div>
          </section>

          <section className="ds-section" id="motion">
            <SectionHeading
              title="Motion"
              description="Short opacity and transform transitions communicate state. All motion presets honor reduced-motion preferences."
            />
            <StaggerContainer className="ds-grid-three">
              <StaggerItem><div className="ds-demo-animation">Stagger child one</div></StaggerItem>
              <StaggerItem><div className="ds-demo-animation">Stagger child two</div></StaggerItem>
              <StaggerItem><div className="ds-demo-animation">Stagger child three</div></StaggerItem>
            </StaggerContainer>
            <div className="ds-grid-three" style={{ marginTop: "0.7rem" }}>
              <FadeIn><div className="ds-demo-animation">Fade in</div></FadeIn>
              <FadeUp><div className="ds-demo-animation">Fade up</div></FadeUp>
              <ScaleIn><div className="ds-demo-animation">Scale in</div></ScaleIn>
            </div>
            <div className="ds-grid-two" style={{ marginTop: "0.7rem" }}>
              <HoverLift><div className="ds-demo-animation">Hover for a gentle lift</div></HoverLift>
              <TapScale><div className="ds-demo-animation">Press for a subtle response</div></TapScale>
            </div>
          </section>

          <footer className="ds-footer">
            <span>Internal component reference | Phase 2</span>
            <Link href="/">Return to LingoPro <ArrowRight size={13} aria-hidden="true" /></Link>
          </footer>
        </div>
      </div>
    </main>
  );
}

function SectionHeading({ title, description }) {
  return (
    <div className="ds-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function TypeRow({ name, children }) {
  return (
    <div className="ds-type-row">
      <span>{name}</span>
      {children}
    </div>
  );
}
