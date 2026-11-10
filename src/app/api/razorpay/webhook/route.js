import { getRazorpayWebhookSecret } from "@/lib/payments/razorpay";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/verification";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_WEBHOOK_BYTES = 1_048_576;

async function readBoundedBody(request) {
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, byteLength).toString("utf8");
}

function logWebhookFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

export async function POST(request) {
  let webhookSecret;
  try {
    webhookSecret = getRazorpayWebhookSecret();
  } catch (error) {
    logWebhookFailure("configure the Razorpay webhook", error);
    return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = await readBoundedBody(request);
  if (rawBody === null) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return Response.json({ error: "Webhook signature is invalid." }, { status: 400 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Webhook payload is malformed." }, { status: 400 });
  }

  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    (typeof body?.id === "string" ? body.id : "");
  const eventType = typeof body?.event === "string" ? body.event : "";
  if (
    !eventId ||
    eventId.length > 255 ||
    !eventType ||
    eventType.length > 160 ||
    !body?.payload ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    return Response.json({ error: "Webhook event structure is invalid." }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("process_razorpay_webhook", {
      target_event_id: eventId,
      target_event_type: eventType,
      event_body: body,
    });
    if (error) {
      logWebhookFailure("process a verified Razorpay event", error);
      const { error: logError } = await service.rpc("log_razorpay_webhook_failure", {
        target_event_id: eventId,
        target_event_type: eventType,
        safe_error_code: String(error.code || "database_error").slice(0, 120),
      });
      if (logError) logWebhookFailure("record a webhook processing failure", logError);
      return Response.json({ error: "Webhook event processing failed." }, { status: 500 });
    }

    return Response.json({ received: true, duplicate: data?.duplicate === true });
  } catch (error) {
    logWebhookFailure("process a verified Razorpay event", error);
    return Response.json({ error: "Webhook processing is temporarily unavailable." }, { status: 503 });
  }
}
