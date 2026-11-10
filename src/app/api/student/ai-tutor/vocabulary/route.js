import { isUuid, validateVocabulary } from "@/lib/ai-tutor/validation";
import {
  getStudentTutorContext,
  isSameOriginMutation,
  jsonResponse,
  logAiTutorFailure,
  readJsonBody,
} from "@/lib/ai-tutor/server";

export async function POST(request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: "This request could not be verified." }, 403);
  }
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) {
    return jsonResponse({ error: parsedBody.error.message }, parsedBody.error.status);
  }
  const validation = validateVocabulary(parsedBody.value);
  if (validation.error) return jsonResponse({ error: validation.error }, 400);

  const context = await getStudentTutorContext();
  if (context.error) {
    return jsonResponse({ error: context.error.message }, context.error.status);
  }

  const { data, error } = await context.client
    .from("student_saved_vocabulary")
    .insert({
      student_id: context.studentId,
      source_conversation_id: validation.value.conversationId,
      word: validation.value.word,
      meaning: validation.value.meaning,
      language: validation.value.language,
      example: validation.value.example,
    })
    .select("id,word,meaning,language,example,created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ error: "That word is already in your saved vocabulary." }, 409);
    }
    logAiTutorFailure("save vocabulary", error);
    return jsonResponse({ error: "The vocabulary item could not be saved." }, 503);
  }
  return jsonResponse({ vocabulary: data }, 201);
}

export async function DELETE(request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: "This request could not be verified." }, 403);
  }
  const parsedBody = await readJsonBody(request);
  if (parsedBody.error) {
    return jsonResponse({ error: parsedBody.error.message }, parsedBody.error.status);
  }
  const { id } = parsedBody.value || {};
  if (!isUuid(id)) return jsonResponse({ error: "This vocabulary item could not be found." }, 400);

  const context = await getStudentTutorContext();
  if (context.error) {
    return jsonResponse({ error: context.error.message }, context.error.status);
  }
  const { data, error } = await context.client
    .from("student_saved_vocabulary")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    logAiTutorFailure("delete saved vocabulary", error);
    return jsonResponse({ error: "The vocabulary item could not be deleted." }, 503);
  }
  if (!data) return jsonResponse({ error: "This vocabulary item could not be found." }, 404);
  return jsonResponse({ deleted: true });
}
