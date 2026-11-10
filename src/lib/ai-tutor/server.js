import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/server";

function logTutorFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    name: error?.name,
    status: error?.status,
    code: error?.code,
  });
}

export async function getStudentTutorContext() {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") {
    return { error: { status: 503, message: "Student services are not configured." } };
  }
  if (auth.status === "unavailable" || auth.status === "profile-unavailable") {
    return { error: { status: 503, message: "Student services are temporarily unavailable." } };
  }
  if (!auth.user) {
    return { error: { status: 401, message: "Sign in to use the AI tutor." } };
  }
  if (auth.role !== "student") {
    return { error: { status: 403, message: "The AI tutor is available to student accounts." } };
  }

  try {
    return {
      client: await createClient(),
      studentId: auth.user.id,
    };
  } catch (error) {
    logTutorFailure("connect to student services", error);
    return { error: { status: 503, message: "Student services are temporarily unavailable." } };
  }
}

export function logAiTutorFailure(operation, error) {
  logTutorFailure(operation, error);
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function isSameOriginMutation(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(request, maxBytes = 16_384) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { error: { status: 415, message: "Send a JSON request." } };
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: { status: 413, message: "The request is too large." } };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { error: { status: 413, message: "The request is too large." } };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: { status: 400, message: "The request body is not valid JSON." } };
  }
}
