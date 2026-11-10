"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import {
  createCourseCheckoutAction,
  createSubscriptionCheckoutAction,
  verifyCourseCheckoutAction,
  verifySubscriptionCheckoutAction,
} from "@/lib/payments/actions";

export default function RazorpayCheckoutButton({
  kind,
  targetId,
  label,
  disabled = false,
}) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageKind, setMessageKind] = useState("information");
  const isCourse = kind === "course";

  async function startCheckout() {
    if (pending || disabled) return;
    setPending(true);
    setMessage(null);

    try {
      const requestId = isCourse ? crypto.randomUUID() : null;
      const result = isCourse
        ? await createCourseCheckoutAction(targetId, requestId)
        : await createSubscriptionCheckoutAction(targetId);
      if (result.verified) {
        setMessageKind("success");
        setMessage(result.message);
        setPending(false);
        router.refresh();
        return;
      }
      if (result.error || !result.checkout) {
        setMessageKind("error");
        setMessage(result.error || "Checkout could not be started.");
        setPending(false);
        return;
      }
      if (!window.Razorpay) {
        setMessageKind("error");
        setMessage("Razorpay Checkout did not load. Check your connection and try again.");
        setPending(false);
        return;
      }

      const checkout = result.checkout;
      const options = isCourse
        ? {
            key: checkout.keyId,
            amount: checkout.amount,
            currency: checkout.currency,
            order_id: checkout.orderId,
            name: "LingoPro",
            description: checkout.title,
            prefill: {},
            theme: { color: "#176b55" },
            handler: async (response) => {
              setPending(true);
              setMessageKind("information");
              setMessage("Verifying the captured payment with Razorpay…");
              try {
                const verified = await verifyCourseCheckoutAction({
                  paymentId: checkout.paymentId,
                  orderId: response.razorpay_order_id,
                  providerPaymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                });
                if (verified.success) {
                  setMessageKind("success");
                  setMessage(verified.message);
                  router.refresh();
                } else {
                  setMessageKind(verified.pending ? "warning" : "error");
                  setMessage(verified.message || verified.error);
                }
              } catch {
                setMessageKind("error");
                setMessage("Payment verification is unavailable. Course access remains locked.");
              } finally {
                setPending(false);
              }
            },
            modal: {
              ondismiss: () => {
                setPending(false);
                setMessageKind("information");
                setMessage("Checkout closed. Course access remains locked until payment is verified.");
              },
            },
          }
        : {
            key: checkout.keyId,
            subscription_id: checkout.providerSubscriptionId,
            name: "LingoPro",
            description: checkout.planName,
            prefill: {},
            theme: { color: "#176b55" },
            handler: async (response) => {
              setPending(true);
              setMessageKind("information");
              setMessage("Verifying the subscription authorization with Razorpay…");
              try {
                const verified = await verifySubscriptionCheckoutAction({
                  subscriptionId: checkout.subscriptionId,
                  providerSubscriptionId: response.razorpay_subscription_id,
                  providerPaymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                });
                setMessageKind(verified.error ? "error" : "warning");
                setMessage(verified.message || verified.error);
                router.refresh();
              } catch {
                setMessageKind("error");
                setMessage("Subscription verification is unavailable. Its status remains pending.");
              } finally {
                setPending(false);
              }
            },
            modal: {
              ondismiss: () => {
                setPending(false);
                setMessageKind("information");
                setMessage("Checkout closed. Subscription status remains pending provider confirmation.");
              },
            },
          };

      const checkoutWindow = new window.Razorpay(options);
      checkoutWindow.on("payment.failed", () => {
        setPending(false);
        setMessageKind("error");
        setMessage("Razorpay reported a failed payment. No course enrollment or subscription was activated.");
        router.refresh();
      });
      checkoutWindow.open();
    } catch {
      setPending(false);
      setMessageKind("error");
      setMessage("Checkout could not be started. Please try again.");
    }
  }

  return (
    <div className="payment-checkout-control">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setSdkReady(false);
          setMessageKind("error");
          setMessage("Razorpay Checkout could not be loaded.");
        }}
      />
      <Button
        type="button"
        loading={pending}
        disabled={disabled || !sdkReady || pending}
        onClick={startCheckout}
        className="payment-checkout-button"
      >
        {pending ? "Verifying…" : !sdkReady ? "Loading secure checkout…" : label}
      </Button>
      {message && (
        <Alert variant={messageKind} className="payment-checkout-message" role="status">
          {message}
        </Alert>
      )}
    </div>
  );
}
