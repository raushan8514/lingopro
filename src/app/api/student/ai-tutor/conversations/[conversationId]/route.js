import { isUuid } from "@/lib/ai-tutor/validation";
import {
  getStudentTutorContext,
  isSameOriginMutation,
  jsonResponse,
  logAiTutorFailure,
} from "@/lib/ai-tutor/server";

export async function GET(_request, { params }) {
  const { conversationId } = await params;
  if (!isUuid(conversationId)) {
    return jsonResponse({ error: "This conversation could not be found." }, 404);
  }

  const context = await getStudentTutorContext();
  if (context.error) {
    return jsonResponse({ error: context.error.message }, context.error.status);
  }

  const { data: conversation, error: conversationError } = await context.client
    .from("ai_tutor_conversations")
    .select("id,title,mode,language,level,topic,updated_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) {
    logAiTutorFailure("load the AI tutor conversation", conversationError);
    return jsonResponse({ error: "This conversation is temporarily unavailable." }, 503);
  }
  if (!conversation) {
    return jsonResponse({ error: "This conversation could not be found." }, 404);
  }

  const { data: messages, error: messagesError } = await context.client
    .from("ai_tutor_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (messagesError) {
    logAiTutorFailure("load AI tutor conversation messages", messagesError);
    return jsonResponse({ error: "Conversation messages are temporarily unavailable." }, 503);
  }

  return jsonResponse({ conversation, messages: (messages || []).reverse() });
}

export async function DELETE(request, { params }) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: "This request could not be verified." }, 403);
  }
  const { conversationId } = await params;
  if (!isUuid(conversationId)) {
    return jsonResponse({ error: "This conversation could not be found." }, 404);
  }

  const context = await getStudentTutorContext();
  if (context.error) {
    return jsonResponse({ error: context.error.message }, context.error.status);
  }

  const { data, error } = await context.client
    .from("ai_tutor_conversations")
    .delete()
    .eq("id", conversationId)
    .select("id")
    .maybeSingle();
  if (error) {
    logAiTutorFailure("delete the AI tutor conversation", error);
    return jsonResponse({ error: "This conversation could not be deleted." }, 503);
  }
  if (!data) return jsonResponse({ error: "This conversation could not be found." }, 404);
  return jsonResponse({ deleted: true });
}
