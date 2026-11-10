import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ai-tutor/validation";
import { isGeminiConfigured } from "@/lib/ai-tutor/provider";
import { logAiTutorFailure } from "@/lib/ai-tutor/server";

export async function getAiTutorPageData(requestedConversationId) {
  const client = await createClient({ allowCookieWrites: false });
  const [conversationsResult, vocabularyResult] = await Promise.all([
    client
      .from("ai_tutor_conversations")
      .select("id,title,mode,language,level,topic,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    client
      .from("student_saved_vocabulary")
      .select("id,word,meaning,language,example,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (conversationsResult.error) {
    logAiTutorFailure("load AI tutor conversations", conversationsResult.error);
    throw new Error("AI tutor conversations are temporarily unavailable.");
  }
  if (vocabularyResult.error) {
    logAiTutorFailure("load saved AI tutor vocabulary", vocabularyResult.error);
    throw new Error("Saved vocabulary is temporarily unavailable.");
  }

  const conversations = conversationsResult.data || [];
  const selectedConversation = isUuid(requestedConversationId)
    ? conversations.find(({ id }) => id === requestedConversationId) || null
    : conversations[0] || null;

  let messages = [];
  if (selectedConversation) {
    const { data, error } = await client
      .from("ai_tutor_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", selectedConversation.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);
    if (error) {
      logAiTutorFailure("load AI tutor conversation messages", error);
      throw new Error("Conversation messages are temporarily unavailable.");
    }
    messages = (data || []).reverse();
  }

  return {
    conversations,
    vocabulary: vocabularyResult.data || [],
    selectedConversation,
    messages,
    isGeminiConfigured: isGeminiConfigured(),
  };
}
