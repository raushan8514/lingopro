import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyOrderPaymentSignature,
  verifyRazorpayWebhookSignature,
  verifySubscriptionPaymentSignature,
} from "../../src/lib/payments/verification.js";
import { formatMinorCurrency } from "../../src/lib/payments/format.js";

const secret = "test-only-signing-secret";

function signature(payload) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

test("accepts only a valid course order payment signature", () => {
  const expected = signature("order_test_123|pay_test_456");
  assert.equal(
    verifyOrderPaymentSignature("order_test_123", "pay_test_456", expected, secret),
    true,
  );
  assert.equal(
    verifyOrderPaymentSignature("order_test_other", "pay_test_456", expected, secret),
    false,
  );
  assert.equal(
    verifyOrderPaymentSignature("order_test_123", "pay_test_456", "invalid", secret),
    false,
  );
  assert.equal(verifyOrderPaymentSignature("", "pay_test_456", expected, secret), false);
});

test("uses Razorpay's documented payment-id then subscription-id signature order", () => {
  const expected = signature("pay_test_456|sub_test_789");
  assert.equal(
    verifySubscriptionPaymentSignature("sub_test_789", "pay_test_456", expected, secret),
    true,
  );
  assert.equal(
    verifySubscriptionPaymentSignature("sub_test_other", "pay_test_456", expected, secret),
    false,
  );
});

test("validates the exact raw webhook body", () => {
  const rawBody = '{"event":"payment.captured","created_at":123}';
  const expected = signature(rawBody);
  assert.equal(verifyRazorpayWebhookSignature(rawBody, expected, secret), true);
  assert.equal(
    verifyRazorpayWebhookSignature(`${rawBody} `, expected, secret),
    false,
  );
  assert.equal(verifyRazorpayWebhookSignature(rawBody, expected, ""), false);
});

test("formats INR paise and zero-decimal currency minor units correctly", () => {
  assert.match(formatMinorCurrency(123456, "INR"), /1,234\.56/);
  assert.match(formatMinorCurrency(1234, "JPY"), /1,234/);
  assert.doesNotMatch(formatMinorCurrency(1234, "JPY"), /\.\d/);
});
