import {
  validatePaymentVerification,
  validateWebhookSignature,
} from "razorpay/dist/utils/razorpay-utils.js";

export function verifyOrderPaymentSignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  try {
    return validatePaymentVerification(
      { order_id: orderId, payment_id: paymentId },
      signature,
      secret,
    );
  } catch {
    return false;
  }
}

export function verifySubscriptionPaymentSignature(
  subscriptionId,
  paymentId,
  signature,
  secret,
) {
  if (!subscriptionId || !paymentId || !signature || !secret) return false;
  try {
    return validatePaymentVerification(
      {
        subscription_id: subscriptionId,
        payment_id: paymentId,
      },
      signature,
      secret,
    );
  } catch {
    return false;
  }
}

export function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  try {
    return validateWebhookSignature(rawBody, signature, secret);
  } catch {
    return false;
  }
}
