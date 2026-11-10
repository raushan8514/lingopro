import { buildTutorInstructions } from "@/lib/ai-tutor/prompts";
import {
  MAX_TUTOR_HISTORY_MESSAGES,
  validateTutorRequest,
} from "@/lib/ai-tutor/validation";
import { generateTutorReply, isGeminiConfigured } from "@/lib/ai-tutor/provider";
import {
  getStudentTutorContext,
  isSameOriginMutation,
  jsonResponse,
  logAiTutorFailure,
  readJsonBody,
} from "@/lib/ai-tutor/server";

function logDatabaseFailure(operation, error) {
  logAiTutorFailure(operation, error);
}

export async function POST(request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: "This request could not be verified." }, 403);
  }

  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) {
    return jsonResponse({ error: parsedBody.error.message }, parsedBody.error.status);
  }
  const validation = validateTutorRequest(parsedBody.value);
  if (validation.error) return jsonResponse({ error: validation.error }, 400);
  const context = await getStudentTutorContext();
  if (context.error) {
    return jsonResponse({ error: context.error.message }, context.error.status);
  }
  if (!isGeminiConfigured()) {
    return jsonResponse({
      error: "The AI tutor is not configured yet. Ask an administrator to add the server-side Gemini API key.",
    }, 503);
  }
  const { client, studentId } = context;
  const requestData = validation.value;

  let conversation;
  if (requestData.conversationId) {
    const { data, error } = await client
      .from("ai_tutor_conversations")
      .select("id,student_id,title,mode,language,level,topic,updated_at")
      .eq("id", requestData.conversationId)
      .maybeSingle();
    if (error) {
      logDatabaseFailure("load the AI tutor conversation", error);
      return jsonResponse({ error: "This conversation is temporarily unavailable." }, 503);
    }
    if (!data) return jsonResponse({ error: "This conversation could not be found." }, 404);
    conversation = data;
  }

  const { data: quotaAvailable, error: quotaError } = await client.rpc(
    "consume_student_ai_tutor_quota",
  );
  if (quotaError) {
    logDatabaseFailure("check the AI tutor usage limit", quotaError);
    return jsonResponse({ error: "The AI tutor is temporarily unavailable." }, 503);
  }
  if (!quotaAvailable) {
    return jsonResponse({
      error: "You’ve reached today’s tutor limit of 20 messages. Please try again tomorrow.",
    }, 429);
  }

  if (!conversation) {
    const { data, error } = await client
      .from("ai_tutor_conversations")
      .insert({
        student_id: studentId,
        title: requestData.message.slice(0, 76).trim() || "Language practice",
        mode: requestData.mode,
        language: requestData.language,
        level: requestData.level,
        topic: requestData.topic,
      })
      .select("id,student_id,title,mode,language,level,topic,updated_at")
      .single();
    if (error || !data) {
      logDatabaseFailure("create the AI tutor conversation", error);
      return jsonResponse({ error: "A new conversation could not be created." }, 503);
    }
    conversation = data;
  }

  const { data: previousMessages, error: historyError } = await client
    .from("ai_tutor_messages")
    .select("role,content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_TUTOR_HISTORY_MESSAGES - 1);
  if (historyError) {
    logDatabaseFailure("load AI tutor conversation history", historyError);
    return jsonResponse({ error: "Conversation history is temporarily unavailable." }, 503);
  }

  const { data: userMessage, error: userMessageError } = await client
    .from("ai_tutor_messages")
    .insert({
      conversation_id: conversation.id,
      student_id: studentId,
      role: "user",
      content: requestData.message,
    })
    .select("id,role,content,created_at")
    .single();
  if (userMessageError || !userMessage) {
    logDatabaseFailure("save the AI tutor message", userMessageError);
    return jsonResponse({ error: "Your message could not be saved." }, 503);
  }

  const history = [
    ...(previousMessages || []).reverse(),
    { role: "user", content: requestData.message },
  ];
  const instructions = buildTutorInstructions({
    mode: conversation.mode,
    language: conversation.language,
    level: conversation.level,
    topic: conversation.topic,
  });

  let reply;
  try {
    reply = await generateTutorReply({
      history,
      instructions,
      signal: request.signal,
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      logAiTutorFailure("receive a Gemini tutor response before timeout", error);
      return jsonResponse({
        error: "The tutor took too long to respond. Your message is saved; please try again.",
        conversation,
        userMessage,
        userMessagePersisted: true,
      }, 504);
    }
    if (error?.name !== "AbortError") {
      logAiTutorFailure("generate a Gemini tutor response", error);
    }
    return jsonResponse({
      error: error?.name === "AbortError"
        ? "The request was stopped. Your message is saved."
        : "The tutor could not respond right now. Your message is saved; please try again.",
      conversation,
      userMessage,
      userMessagePersisted: true,
    }, 502);
  }

  const { data: assistantMessage, error: assistantMessageError } = await client
    .from("ai_tutor_messages")
    .insert({
      conversation_id: conversation.id,
      student_id: studentId,
      role: "assistant",
      content: reply,
    })
    .select("id,role,content,created_at")
    .single();
  if (assistantMessageError || !assistantMessage) {
    logDatabaseFailure("save the AI tutor reply", assistantMessageError);
    return jsonResponse({
      error: "The tutor replied, but the reply could not be saved. Please try again.",
      conversation,
      userMessage,
      userMessagePersisted: true,
    }, 503);
  }

  const updatedConversation = {
    ...conversation,
    updated_at: assistantMessage.created_at,
  };
  return jsonResponse({
    conversation: updatedConversation,
    userMessage,
    assistantMessage,
  });
}
