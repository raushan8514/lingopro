import "server-only";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 25_000;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateTutorReply({ history, instructions, signal }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("Gemini is not configured.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  const client = new GoogleGenAI({ apiKey });
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const abortSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  // const interaction = await client.interactions.create({
  //   model: getGeminiModel(),
  //   input: history.map(({ role, content }) => ({
  //     type: role === "assistant" ? "model_output" : "user_input",
  //     content: [{ type: "text", text: content }],
  //   })),
  //   system_instruction: instructions,
  //   generation_config: {
  //     max_output_tokens: 700,
  //     thinking_level: "low",
  //   },
  //   store: false,
  //   abortSignal,
  // });

  let interaction;

try {
  interaction = await client.interactions.create({
    model: getGeminiModel(),
    input: history.map(({ role, content }) => ({
      type: role === "assistant" ? "model_output" : "user_input",
      content: [{ type: "text", text: content }],
    })),
    system_instruction: instructions,
    generation_config: {
      max_output_tokens: 700,
      thinking_level: "low",
    },
    store: false,
    // abortSignal,
  });
} catch (error) {
  console.error("Gemini diagnostic:", {
    name: error?.name,
    status: error?.status,
    message: error?.message,
    details: error?.errorDetails,
  });
  throw error;
}


  const reply = typeof interaction.output_text === "string"
    ? interaction.output_text.trim()
    : "";
  if (!reply) {
    const error = new Error("Gemini returned no text.");
    error.code = "GEMINI_EMPTY_RESPONSE";
    throw error;
  }
  return reply;
}
