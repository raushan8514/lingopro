# LingoPro Component Reference

The reusable UI primitives live in `src/components/ui` and are available from
the `@/components/ui` barrel. Layout foundations live in
`src/components/layout/primitives.js`; theme state and motion helpers live under
`src/components/shared`.

## Importing

```jsx
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
```

## UI components

| Component | Purpose and key props |
|---|---|
| `Button` | `variant`: `primary`, `secondary`, `outline`, `ghost`, `destructive`; `size`: `sm`, `md`, `lg`, `icon`; `loading`, `disabled`, `leftIcon`, `rightIcon`. |
| `Input` | Native input with optional `label`, `hint`, `error`, `required`, and standard input props. |
| `Textarea` | Labeled native textarea with hint/error support and native resize behavior. |
| `Select` | Accessible native select with label, hint, and error support. |
| `Checkbox` | Native checkbox with label, optional description, and standard input props. |
| `Switch` | Button switch with `checked`, `onCheckedChange`, `label`, `description`, and `disabled`. |
| `Badge` | `neutral`, `success`, `warning`, `error`, or `information` status. |
| `Card` | Surface with optional `hover`; compose `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`. |
| `Avatar` | Accessible initials fallback with optional image URL and `sm`, `md`, or `lg` size. |
| `Progress` | Clamped percentage progress with accessible value and optional label/value display. |
| `Skeleton` | Decorative loading placeholder; mark its containing region busy when appropriate. |
| `Spinner` | Lucide loading indicator with a configurable accessible status label. |
| `Tooltip` | Focus- and hover-triggered supplemental content; `side` supports `top` and `bottom`. |
| `Tabs` | Controlled (`value`, `onValueChange`) or uncontrolled (`defaultValue`) tabs with arrow/Home/End keyboard navigation. Use `TabsList`, `TabsTrigger`, and `TabsContent`. |
| `Dialog` | Native modal dialog with focus management and Escape handling. Control with `open` and `onOpenChange`; provide `title`, optional `description`, `children`, and `footer`. |
| `DropdownMenu` | Trigger plus menu items (`label`, optional `icon`, `onSelect`, `disabled`, `destructive`, or `separator`); supports keyboard navigation and outside dismissal. |
| `EmptyState` | Icon, concise title, optional description, and action for a genuinely empty product view. |
| `Alert` | `information`, `success`, `warning`, or `error` message with optional title and description. |
| `Separator` | Semantic horizontal or vertical separator. |
| `Breadcrumb` | Ordered navigation items with links and current-page semantics. |
| `ThemeSwitcher` | Functional Light, Dark, and System mode controls. Requires the root `ThemeProvider`. |

Use native control props for browser validation, form submission, and disabled
behavior. Avoid replacing a native element when its built-in semantics cover
the interaction.

Use Lucide React for interface icons, usually at 16–18px with a 1.8px stroke.
Mark decorative icons `aria-hidden="true"`; provide an accessible label when an
icon is the only content in a control.

## Layout foundations

`Container`, `Section`, `Stack`, `Grid`, `ResponsiveContent`, `PageHeader`, and
`AppNavigation` are exported from `@/components/layout/primitives`. The layout
components accept semantic `as` elements where appropriate. `Grid` accepts a
column count and responsive gaps; the mobile layout caps columns at two.

## Theme and design tokens

Wrap the application in `ThemeProvider` (already installed in the root layout)
and use `useTheme()` for the selected `light`, `dark`, or `system` preference.
`ThemeSwitcher` persists the selection in local storage. The root layout's
early script applies the saved preference before paint to reduce theme flashes.

Use semantic CSS variables such as `--background`, `--foreground`, `--card`,
`--primary`, `--muted-foreground`, `--border`, `--ring`, `--success`,
`--warning`, `--destructive`, and `--information`. Tailwind v4 color utilities
are mapped to the same tokens in `src/app/globals.css`.

## Motion utilities

Import `FadeIn`, `FadeUp`, `ScaleIn`, `StaggerContainer`, `StaggerItem`,
`HoverLift`, `TapScale`, `PageTransition`, `ScrollReveal`, `ScrollStagger`, or
`ScrollStaggerItem` from `@/components/shared/animations`. These helpers respect
reduced-motion preferences and keep their initial server-rendered state
hydration-safe. The existing `Entrance` component remains available to the
Phase 1 welcome screen.

## Showcase

Visit `/design-system` for the responsive internal component and token
reference. It is marked `noindex` and is not included in public navigation.

## Public website

The root route is composed from `src/components/landing`. Shared presentation
content lives in `src/lib/landing-content.js`; responsive section styles are in
`src/app/landing.css` and use the semantic tokens from `globals.css`.

| Component | Purpose |
|---|---|
| `SiteHeader` / `SiteFooter` | Responsive in-page navigation; the header renders signed-out auth links or a server-verified account menu. |
| `Hero` / `FinalCTA` | Product introduction and in-page exploration prompts. |
| `LanguageDiscovery` | Selectable illustrative language and starting-point previews. |
| `FeatureGrid` / `LearningJourney` | Product direction and learning-flow overview. |
| `CoursePreview` | Filterable illustrative course cards; not connected to a catalog. |
| `TutorPreview` / `ProductPreviews` | Static interface concepts, not active services or learner data. |
| `Pricing` / `Testimonials` | Proposed plan concepts and sample brand copy, explicitly not live offers or customer reviews. |
| `FAQ` | Keyboard-operable, single-open disclosure list. |
| `SectionHeading` / `ActionLink` | Shared landing section heading and design-system button-style anchor. |

The marketing sections use `ScrollReveal`, `ScrollStagger`, and
`ScrollStaggerItem` from the shared motion utilities. Client components are
limited to genuine page interactions; the remaining sections render on the
server.

## Student AI tutor

`AiTutorWorkspace` in `src/components/student/ai-tutor-workspace.js` provides
the student-only tutor interface: six practice modes, bounded conversation
history, loading/error/stop states, deletable conversations, and saved
vocabulary. It uses plain-text message rendering and native labeled controls;
provider calls and Supabase ownership checks remain server-side.

## Administrator workspace

The protected `/admin/**` routes share the responsive portal shell and add
their route-level presentation in `src/app/admin/admin.css`. Reusable admin
headers, panels, status indicators, tables/search pagination, and date helpers
are in `src/components/admin/admin-components.js`. Role, course moderation,
category, settings, and assessment actions are exposed through
`src/components/admin/admin-forms.js`, with server authorization and
validation in `src/app/admin/actions.js`. Admin list/report data is loaded
server-side through `src/lib/admin/data.js`; privileged summaries and
moderation are additionally protected by PostgreSQL admin-only RPCs and RLS.

## Course marketplace

The marketplace routes are `/courses`, `/courses/[slug]`, `/categories`,
`/categories/[slug]`, and `/instructors/[id]`. `CourseCard` displays only
database-backed published course fields; `CourseCatalog` composes actual
category data, URL-backed search/filter/sort/pagination, empty/error states,
and reduced-motion course entrance effects. `CourseCatalogControls` owns the
debounced search input, filter URL synchronization, and accessible mobile
filter dialog. `CourseThumbnail` and `InstructorAvatar` provide image-failure
fallbacks. Course details use `EnrollmentAction`, which allows free enrollment
only through the authenticated RLS-protected server action and explicitly
blocks paid enrollment until payment verification is implemented. Marketplace
queries and the restricted public read RPCs are in `src/lib/courses`.

## Authentication components

`src/components/auth/auth-shell.js` provides the responsive, theme-aware
split-screen form foundation. `auth-forms.js` contains accessible login,
registration, verification-resend, password-recovery, and password-reset forms
that submit to server actions in `src/app/auth/actions.js`. They do not create
sessions locally; Supabase must be configured for account operations.
`AccountMenu` uses the database-verified role from the server-rendered header
and exposes the matching protected portal and sign-out action.

## Student workspace

The protected student routes are `/student`, `/student/courses`,
`/student/progress`, `/student/achievements`, `/student/activity`,
`/student/goals`, `/student/notifications`, `/student/profile`, and
`/student/settings`. Lesson learning is available at
`/student/courses/[courseId]/learn` and
`/student/courses/[courseId]/learn/[lessonId]`. `StudentPortalShell` in
`src/components/student/student-portal-shell.js` provides responsive
navigation, mobile drawer behavior, sidebar collapse, the account menu, and
theme controls. Reusable student-specific cards, lists, and chart components
are in `src/components/student`.

Server-rendered pages read through `src/lib/student/data.js`; mutations are
server actions in `src/app/student/actions.js`. They require a verified
student role and use the ordinary SSR Supabase client, with PostgreSQL RLS
remaining authoritative. Avatar files use the private `user-avatars` bucket.
Progress and activity show only persisted lesson, quiz, certificate,
enrollment, and notification records. Opening a lesson records last access for
resume behavior, but it does not mark progress complete or create a lesson
completion activity.
Student course cards open the learner workspace and resume the server-projected
unfinished or next unstarted lesson when one is available. Email and push
delivery preferences are not represented as working controls.

### Assessment system (Phase 9)

The protected student routes are `/student/assessments`,
`/student/assessments/history`,
`/student/assessments/[assessmentId]`,
`/student/assessments/[assessmentId]/attempt?attemptId=attempt-id`, and
`/student/assessments/[assessmentId]/result/[attemptId]`.
`AssessmentCard` and `AssessmentHistory` render server-projected available
work and the learner's attempt record. `AssessmentStartButton` starts or
resumes only through a server action. `AssessmentAttempt` owns question
navigation, saved answers, flags, the server-timestamp countdown, and submit
confirmation. `LearningAssessments` links course and lesson learning to
matching published assessments.

The browser does not grade or decide access. Start/save/submit operations are
server actions over owner-scoped PostgreSQL functions; reload restores saved
answers and database-persisted randomized order. Short answers are visibly
identified as requiring instructor review. Correct answers and explanations
appear only after submission when enabled by the assessment configuration.
Course-manager authoring screens are intentionally not included.

### Student lesson workspace (Phase 8)

`LearningCourseOverview` and `LearningCurriculum` render the published,
enrolled course path. `LessonLearningWorkspace` combines lesson navigation,
`LessonPlayer`, `StructuredLessonContent`, and `LessonResources`. The media
player uses native video/audio controls or an approved YouTube embed, restores
saved playback, and reports progress through the student server actions.
Private Storage objects are exposed only as short-lived server-signed URLs
after course and lesson authorization.

Structured lesson content uses a JSON object with a `blocks` array. Supported
block types are:

| `type` | Required/optional fields |
|---|---|
| `heading` | `text`; optional `level` (`3` renders a subheading) |
| `paragraph` | `text` |
| `vocabulary` | `term`, `definition` or `meaning`; optional `example` |
| `grammar` | Optional `title`; `explanation` or `text` |
| `example` | `text` or `example`; optional `translation` |
| `list` | `items`, an array of strings |
| `image` | `src` or `url` (HTTPS only); optional `alt`, `caption` |
| `note` | `text`; optional `title` |

Text is rendered as React text, never HTML. Unsupported blocks are omitted;
images with non-HTTPS or malformed URLs are omitted. Quiz-taking, examinations,
lesson authoring, and instructor/admin dashboards are not part of this phase.

The student workspace is separate from the instructor and admin portals.
See [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) for provider
configuration and role provisioning.

## Instructor workspace (Phase 10)

The protected instructor routes are `/instructor`,
`/instructor/courses`, `/instructor/courses/new`,
`/instructor/courses/[courseId]`, and course-scoped curriculum, learner, and
assessment pages. `/instructor/assessments` and
`/instructor/assessments/[assessmentId]` provide assessment management and
manual grading. Profile and account preferences are available at
`/instructor/profile` and `/instructor/settings`.

`StudentPortalShell` accepts an instructor role to render separate navigation
and workspace labels while retaining the same responsive drawer and theme
controls. `src/components/instructor/instructor-components.js` contains
instructor page headers, metrics, panels, status labels, empty states, and
date-formatting helpers. `instructor-forms.js` provides course, section,
lesson, external-resource, assessment, question, grading, profile, deletion,
publication, and curriculum-reordering controls. Forms use server actions;
server-side role/ownership checks and database RLS remain mandatory.

Question option updates use one transactional database RPC, are disabled while
published, and become immutable after an attempt starts. Private resource
uploads are not implemented; curriculum resources and external lesson media
accept HTTPS links only. Existing private media paths are not overwritten by
the editor. Course publication and archiving are administrator-controlled.
