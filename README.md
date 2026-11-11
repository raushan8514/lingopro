# LingoPro — Learn Languages. Build Confidence. Earn Recognition.

<p align="center">
  <strong>A Full-Stack Language Learning & Certification Platform</strong>
</p>

<p align="center">
  An interactive learning ecosystem designed to help students learn languages, practice through assessments, track their progress, and earn certificates through a structured digital experience.
</p>

<p align="center">
  <a href="https://lingopro-three.vercel.app/"><strong>Live Application</strong></a> •
  <a href="https://github.com/raushan8514/lingopro"><strong>GitHub Repository</strong></a>
</p>

---

## Overview

**LingoPro** is a full-stack language-learning platform built with the Next.js App Router. It brings together structured courses, interactive assessments, personalized learning experiences, AI-powered language practice, and certification workflows in one application.

The platform is designed around two primary experiences:

- **Student Experience:** Discover courses, access learning content, complete assessments, monitor progress, and manage learning activities.
- **Administration & Instruction:** Manage learning content, organize courses and lessons, oversee student activity, and support the learning ecosystem through role-based access.

LingoPro combines a modern JavaScript application architecture with Supabase-backed authentication and data management, Google Gemini AI integration, and Razorpay payment infrastructure.

**Project Role:** Project Lead & Sole Developer  
**Development:** Independently designed and developed  
**Deployment:** Vercel

---

## Live Application

| Resource | Link |
|---|---|
| Live Platform | https://lingopro-three.vercel.app/ |
| Source Code | https://github.com/raushan8514/lingopro |
| Project Documentation | [FEATURE_STATUS.md](FEATURE_STATUS.md) |
| Architecture | [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) |

---

## Key Features

### 1. Authentication & Account Management
- Supabase-backed authentication foundation.
- Student and administrative role separation.
- Protected application routes.
- Session-aware application experience.
- Database-level access controls using Row Level Security (RLS).

### 2. Course Marketplace
- Published course discovery.
- Structured course organization.
- Course and category management.
- Instructor-oriented course creation foundations.
- Enrollment-related workflows.

### 3. Student Learning Workspace
- Dedicated student dashboard.
- Personal learning workspace.
- Course and lesson access.
- Learning activity and progress tracking.
- Student profile and account settings.
- Achievements and learning-related records.

### 4. Interactive Assessment System
- Multiple assessment question formats:
  - Multiple choice
  - True/False
  - Fill in the blanks
  - Short answer
  - Long answer
  - Matching questions
- Question ordering and publication checks.
- Assessment and attempt data foundations.

### 5. Certification System
- Certificate generation infrastructure.
- Certificate-related student workflows.
- PDF generation and certificate management foundations.
- Certificate verification and related database workflows.

### 6. AI-Powered Language Tutor
Powered by **Google Gemini**, the AI tutor introduces personalized language practice through six learning modes.

- Interactive language practice.
- AI-assisted learning conversations.
- Saved conversations.
- Personal vocabulary management.
- Student-specific tutor access.
- Conversation history management.

See [AI_TUTOR.md](AI_TUTOR.md) for configuration, privacy, rate limits, and verification details.

### 7. Payments & Subscriptions
Integrated payment infrastructure using **Razorpay**.

- Course purchase workflows.
- Subscription plan foundations.
- Server-side payment verification.
- Webhook processing.
- Transaction history.
- Private printable receipts.

Payment workflows require the appropriate Razorpay configuration and integration verification. Test Mode should be used before any live payment processing.

See [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md).

### 8. Administrative Workspace
- Dedicated administrative application area.
- Course management.
- Category and lesson management.
- Student and instructor management foundations.
- Enrollment management.
- Administrative settings.

Administrative operations are designed around authorization and database access policies.

---

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js, React |
| Application Framework | Next.js App Router |
| Language | JavaScript (ES6+) |
| Styling | Tailwind CSS |
| Backend & Data | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Database Security | Row Level Security (RLS) |
| AI Integration | Google Gemini API |
| Payment Gateway | Razorpay |
| Deployment | Vercel |
| Version Control | Git & GitHub |
| Testing | ESLint, automated test scripts, Supabase database tests |

---

## Application Architecture

LingoPro follows a modular application architecture built around the Next.js App Router and Supabase-backed services.

```text
                    LINGOPRO
                       |
          +------------+------------+
          |                         |
     Public Platform          Protected Platform
          |                         |
    Course Discovery       Authentication & Roles
    Landing Experience             |
                           +-------+-------+
                           |               |
                     Student Area     Admin Area
                           |               |
                    Learning Space   Content Management
                    Courses          Courses & Lessons
                    Assessments      Students & Instructors
                    AI Tutor         Enrollments
                    Certificates     Settings
                           |
                    Supabase Backend
                           |
              +------------+------------+
              |            |            |
          PostgreSQL   Supabase Auth   Storage
              |
        Row Level Security
              |
       External Integrations
              |
       +------+------+
       |             |
   Gemini AI      Razorpay
```

The architecture separates public experiences, authenticated workflows, administrative operations, database access, and external integrations.

For implementation details, see [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md).

---

## Getting Started

Follow these steps to run LingoPro locally.

### Prerequisites

Make sure the following tools are installed:

- Node.js 20.9 or newer
- npm
- Git
- A code editor such as Visual Studio Code
- A Supabase project for backend-powered functionality

### 1. Clone the repository

```bash
git clone https://github.com/raushan8514/lingopro.git
```

### 2. Navigate to the project

```bash
cd lingopro
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure the required values.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

APP_BASE_URL=http://localhost:3000

RAZORPAY_MODE=test
RAZORPAY_KEY_ID=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

Optional billing information:

```env
BILLING_BUSINESS_NAME=
BILLING_BUSINESS_ADDRESS=
BILLING_SUPPORT_EMAIL=
```

**Security Notice:**
- Never commit `.env.local` or files containing real credentials.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser-side code.
- Keep Razorpay secrets and Gemini API keys server-side.
- Use placeholder values in `.env.example`.
- Configure production environment variables separately in Vercel.

### 5. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Public pages can run without Supabase credentials. Authentication and database-powered workflows require the appropriate Supabase configuration.

---

## Database & Supabase Setup

LingoPro uses Supabase for authentication, PostgreSQL data management, and database-level access control.

Before using backend-powered workflows:

1. Create and configure a Supabase project.
2. Configure the required environment variables.
3. Link the correct Supabase project using the Supabase CLI.
4. Review the migration files in the `supabase/` directory.
5. Apply pending migrations to the intended database.
6. Verify authentication, database access, and RLS policies.

Example CLI commands:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
```

Apply migrations only after reviewing the migration history and confirming which migrations are pending:

```bash
supabase db push
```

Do not apply migrations blindly to an existing production database.

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [DATABASE_SECURITY.md](DATABASE_SECURITY.md), and [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run test:payments` | Run payment signature and currency-format tests |
| `npm run test:ai-tutor` | Run AI tutor validation and mode-instruction tests |
| `npm run test:certificates` | Run certificate PDF generation tests |
| `supabase test db` | Run local database and RLS test suites |

---

## Deployment

LingoPro is deployed using Vercel.

### Production Deployment

1. Connect the GitHub repository to Vercel.
2. Configure the required production environment variables.
3. Confirm the production Supabase project and migration state.
4. Configure authentication URLs and allowed redirects.
5. Configure external service credentials.
6. Deploy the application.
7. Test the deployed application using real production configuration.

**Production URL:**

https://lingopro-three.vercel.app/

A successful build alone does not verify every backend integration. Authentication, database workflows, AI functionality, certificates, and payment processing should be tested independently.

---

## Security & Privacy

Security is an important part of LingoPro's architecture.

The project incorporates:

- Supabase authentication.
- Role-based access foundations.
- PostgreSQL Row Level Security.
- Protected student and administrative workflows.
- Server-side handling of sensitive integration credentials.
- Server-verified Razorpay payment operations.
- Student-specific AI tutor access.
- Database-backed authorization policies.

Sensitive credentials must remain outside the source repository and browser bundle.

See [DATABASE_SECURITY.md](DATABASE_SECURITY.md) for additional details.

---

## Project Documentation

The repository includes dedicated documentation for the platform's architecture and functionality.

| Document | Description |
|---|---|
| [PROJECT_MASTER_PLAN.md](PROJECT_MASTER_PLAN.md) | Project planning and implementation roadmap |
| [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) | Application architecture |
| [FEATURE_STATUS.md](FEATURE_STATUS.md) | Feature implementation and verification status |
| [COMPONENTS.md](COMPONENTS.md) | Component reference |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Database structure |
| [DATABASE_SECURITY.md](DATABASE_SECURITY.md) | Database security and RLS |
| [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) | Authentication configuration |
| [ASSESSMENT_SYSTEM.md](ASSESSMENT_SYSTEM.md) | Assessment functionality |
| [CERTIFICATION_WORKFLOW.md](CERTIFICATION_WORKFLOW.md) | Certification workflows |
| [AI_TUTOR.md](AI_TUTOR.md) | AI tutor documentation |
| [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md) | Payment integration guide |

---

## Development & Verification Status

LingoPro has been developed through multiple implementation phases.

The repository's `FEATURE_STATUS.md` is the source of truth for individual feature implementation, testing, and verification status.

Some workflows require:
- Configured external service credentials.
- Applied database migrations.
- Valid authenticated student, instructor, or administrative sessions.
- End-to-end integration testing.

A locally successful build or unit test does not automatically mean every production workflow has been fully verified.

---

## Project Highlights

- Independently designed and developed as a full-stack project.
- Built using a modern JavaScript and Next.js architecture.
- Integrated authentication and database-backed workflows.
- Implemented interactive learning and assessment foundations.
- Added AI-assisted language practice.
- Integrated payment infrastructure.
- Deployed on Vercel.
- Documented architecture, database, security, and integration workflows.

---

## Future Scope

Potential areas for continued development include:

- Expanded language course catalog.
- More personalized learning recommendations.
- Advanced learning analytics.
- Additional assessment types.
- Improved instructor and administrative reporting.
- More language practice experiences.
- Further accessibility and performance improvements.

---

## Author

**Raushan Kumar Sahni**

Project Lead & Sole Developer

B.Tech — Computer Science and Engineering

**GitHub:** [@raushan8514](https://github.com/raushan8514)

**Project:** [LingoPro](https://lingopro-three.vercel.app/)

---

<p align="center">
  <strong>LingoPro — Learn Better. Practice Smarter. Grow Further.</strong>
</p>

<p align="center">
  Built with dedication, curiosity, and a passion for technology.
</p>
