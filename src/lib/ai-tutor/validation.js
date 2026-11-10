export const AI_TUTOR_MODES = Object.freeze([
  "conversation",
  "grammar",
  "vocabulary",
  "writing",
  "interview",
  "daily-practice",
]);

export const AI_TUTOR_LANGUAGES = Object.freeze([
  "Arabic",
  "English",
  "French",
  "German",
  "Hindi",
  "Italian",
  "Japanese",
  "Korean",
  "Mandarin Chinese",
  "Portuguese",
  "Spanish",
]);

export const AI_TUTOR_LEVELS = Object.freeze([
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
]);

export const MAX_TUTOR_MESSAGE_LENGTH = 1500;
export const MAX_TUTOR_TOPIC_LENGTH = 80;
export const MAX_TUTOR_HISTORY_MESSAGES = 12;

export function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateTutorRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter a message to continue." };
  }

  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message || message.length > MAX_TUTOR_MESSAGE_LENGTH) {
    return {
      error: `Messages must be between 1 and ${MAX_TUTOR_MESSAGE_LENGTH} characters.`,
    };
  }

  if (value.conversationId != null && !isUuid(value.conversationId)) {
    return { error: "This conversation could not be found." };
  }

  const mode = value.mode ?? "conversation";
  const language = value.language ?? "Spanish";
  const level = value.level ?? "A2";
  if (value.topic != null && typeof value.topic !== "string") {
    return { error: "Topics must be text." };
  }
  const topic = typeof value.topic === "string" ? value.topic.trim() : "";

  if (!AI_TUTOR_MODES.includes(mode)) {
    return { error: "Choose a valid practice mode." };
  }
  if (!AI_TUTOR_LANGUAGES.includes(language)) {
    return { error: "Choose a supported learning language." };
  }
  if (!AI_TUTOR_LEVELS.includes(level)) {
    return { error: "Choose a valid proficiency level." };
  }
  if (topic.length > MAX_TUTOR_TOPIC_LENGTH) {
    return { error: `Topics must be ${MAX_TUTOR_TOPIC_LENGTH} characters or fewer.` };
  }

  return {
    value: {
      message,
      conversationId: value.conversationId || null,
      mode,
      language,
      level,
      topic,
    },
  };
}

export function validateVocabulary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter a word and its meaning." };
  }

  const word = typeof value.word === "string" ? value.word.trim() : "";
  const meaning = typeof value.meaning === "string" ? value.meaning.trim() : "";
  if (value.example != null && typeof value.example !== "string") {
    return { error: "Example sentences must be text." };
  }
  const example = typeof value.example === "string" ? value.example.trim() : "";
  const language = value.language;

  if (!word || word.length > 100 || !meaning || meaning.length > 200) {
    return { error: "Words must be up to 100 characters and meanings up to 200 characters." };
  }
  if (example.length > 500) {
    return { error: "Example sentences must be 500 characters or fewer." };
  }
  if (!AI_TUTOR_LANGUAGES.includes(language)) {
    return { error: "Choose a supported learning language." };
  }
  if (value.conversationId != null && !isUuid(value.conversationId)) {
    return { error: "This conversation could not be found." };
  }

  return {
    value: {
      word,
      meaning,
      example: example || null,
      language,
      conversationId: value.conversationId || null,
    },
  };
}
