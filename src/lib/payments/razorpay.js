import "server-only";
import Razorpay from "razorpay";

const KEY_PREFIX_BY_MODE = {
  test: "rzp_test_",
  live: "rzp_live_",
};

export function getRazorpayConfiguration() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const mode = process.env.RAZORPAY_MODE || "test";

  if (!["test", "live"].includes(mode)) {
    throw new Error("RAZORPAY_MODE must be either test or live.");
  }
  if (!keyId || !keySecret || !publicKeyId) {
    throw new Error(
      "Razorpay is not configured. Set the server and public key IDs and server secret.",
    );
  }
  if (publicKeyId !== keyId) {
    throw new Error("The public Razorpay key ID must match the server key ID.");
  }
  if (!keyId.startsWith(KEY_PREFIX_BY_MODE[mode])) {
    throw new Error(`The Razorpay key ID does not match ${mode} mode.`);
  }
  return { keyId, keySecret, publicKeyId, mode };
}

export function isRazorpayCheckoutAvailable() {
  try {
    getRazorpayConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function getRazorpayWebhookSecret() {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is required for webhook processing.");
  }
  return webhookSecret;
}

export function createRazorpayClient() {
  const { keyId, keySecret } = getRazorpayConfiguration();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}
