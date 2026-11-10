export const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "Courses", href: "/courses" },
  { label: "Categories", href: "/categories" },
  { label: "Explore", href: "#explore" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const languages = [
  { id: "english", name: "English", symbol: "Aa", note: "Latin alphabet" },
  { id: "spanish", name: "Spanish", symbol: "Ñ", note: "Latin alphabet" },
  { id: "french", name: "French", symbol: "é", note: "Latin alphabet" },
  { id: "german", name: "German", symbol: "Ä", note: "Latin alphabet" },
  { id: "japanese", name: "Japanese", symbol: "あ", note: "Japanese scripts" },
  { id: "korean", name: "Korean", symbol: "한", note: "Hangul" },
  { id: "italian", name: "Italian", symbol: "ciao", note: "Latin alphabet" },
];

export const learningLevels = [
  { id: "starting", label: "Just starting" },
  { id: "building", label: "Building confidence" },
  { id: "advancing", label: "Ready to advance" },
];

export const features = [
  {
    id: "lessons",
    icon: "BookOpenText",
    title: "Interactive lessons",
    description:
      "Short, focused activities designed to make practice feel useful and easy to return to.",
    tone: "mint",
  },
  {
    id: "paths",
    icon: "Route",
    title: "Personal learning paths",
    description:
      "A clear next step for the skills and situations you want to make your own.",
    tone: "lavender",
  },
  {
    id: "tutor",
    icon: "MessagesSquare",
    title: "AI tutor concept",
    description:
      "A future conversation partner for gentle corrections, vocabulary, and guided practice.",
    tone: "peach",
  },
  {
    id: "quizzes",
    icon: "ListChecks",
    title: "Thoughtful check-ins",
    description:
      "Quick knowledge checks help you pause, recall, and see what is becoming familiar.",
    tone: "blue",
  },
  {
    id: "progress",
    icon: "ChartNoAxesCombined",
    title: "Meaningful progress",
    description:
      "Understand your learning rhythm with clear signals, not pressure or streaks.",
    tone: "gold",
  },
  {
    id: "certificates",
    icon: "Award",
    title: "Milestones worth keeping",
    description:
      "A considered way to mark learning milestones and celebrate the work behind them.",
    tone: "rose",
  },
  {
    id: "media",
    icon: "AudioLines",
    title: "Listen and see language",
    description:
      "Bring context to new words through audio-first and visual learning formats.",
    tone: "mint",
  },
  {
    id: "access",
    icon: "PanelsTopLeft",
    title: "One flexible home",
    description:
      "A platform designed to bring your learning materials and practice together.",
    tone: "lavender",
  },
];

export const learningSteps = [
  { number: "01", icon: "Languages", title: "Choose a language", description: "Start with a language that opens a door for you." },
  { number: "02", icon: "Compass", title: "Find your direction", description: "Choose a path that fits your goals and starting point." },
  { number: "03", icon: "BookOpenText", title: "Learn in context", description: "Build useful skills through focused lesson experiences." },
  { number: "04", icon: "ListChecks", title: "Practice and recall", description: "Revisit ideas with short, considered knowledge checks." },
  { number: "05", icon: "ChartNoAxesCombined", title: "Notice your progress", description: "See the steady work that adds up over time." },
  { number: "06", icon: "Award", title: "Celebrate milestones", description: "Mark your learning moments and keep moving forward." },
];

export const courseCategories = [
  { id: "all", label: "All examples" },
  { id: "conversation", label: "Conversation" },
  { id: "foundations", label: "Foundations" },
  { id: "everyday", label: "Everyday life" },
];

export const coursePreviews = [
  {
    id: "first-conversations",
    category: "conversation",
    language: "Spanish",
    level: "Beginner-friendly",
    format: "Guided conversation",
    title: "Your first conversations",
    description: "A sample path through introductions, questions, and everyday exchanges.",
    artwork: "course-coral",
    monogram: "hola",
  },
  {
    id: "french-foundations",
    category: "foundations",
    language: "French",
    level: "Foundations",
    format: "Interactive lesson",
    title: "A foundation in French",
    description: "An illustrative lesson sequence for sounds, useful phrases, and context.",
    artwork: "course-green",
    monogram: "bonjour",
  },
  {
    id: "everyday-japanese",
    category: "everyday",
    language: "Japanese",
    level: "Starting out",
    format: "Audio + practice",
    title: "Japanese, day by day",
    description: "A concept for building familiarity with daily words and expressions.",
    artwork: "course-indigo",
    monogram: "ことば",
  },
];

export const sampleTestimonials = [
  {
    quote:
      "The best learning routine is the one that makes space for real life. That's the feeling we want this product to create.",
    attribution: "LingoPro experience concept",
    context: "Sample copy · not a customer testimonial",
  },
  {
    quote:
      "Progress can be quiet. A well-chosen phrase, understood at the right moment, can change how a whole conversation feels.",
    attribution: "LingoPro learning philosophy",
    context: "Sample copy · not a customer testimonial",
  },
  {
    quote:
      "Learning a language is about more than the words. It is a small invitation to meet the world with curiosity.",
    attribution: "LingoPro brand concept",
    context: "Sample copy · not a customer testimonial",
  },
];

export const frequentlyAskedQuestions = [
  {
    id: "language-learning",
    question: "Which languages will I be able to explore?",
    answer:
      "English, Spanish, French, German, Japanese, Korean, and Italian are shown as illustrative options on this page. Published courses and launch availability have not been announced.",
  },
  {
    id: "course-access",
    question: "How will course access work?",
    answer:
      "Course access is still being planned. This preview does not connect to a course catalog or learner account.",
  },
  {
    id: "subscriptions",
    question: "Will LingoPro have a subscription?",
    answer:
      "Subscription plans are being considered, but pricing and plan details are not final. No subscription or payment is available on this site.",
  },
  {
    id: "quizzes",
    question: "Will I be able to check my progress?",
    answer:
      "Learning checks and progress views are part of the product direction. The interface examples here are visual previews, not live learning records.",
  },
  {
    id: "certificates",
    question: "Will courses include certificates?",
    answer:
      "Certificates are a planned concept. Availability, recognition, and course requirements have not been confirmed.",
  },
  {
    id: "ai-learning",
    question: "Can I practice with an AI tutor now?",
    answer:
      "Not yet. The conversation shown on this page is sample content only; no AI service or tutor is connected.",
  },
  {
    id: "cancellation",
    question: "Can I cancel a plan?",
    answer:
      "There are no paid plans to cancel at this time. Billing and cancellation policies will be published if subscriptions launch.",
  },
];
