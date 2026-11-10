"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { cancelSubscriptionAction } from "@/lib/payments/actions";

export default function SubscriptionCancelForm({ subscriptionId }) {
  const [state, formAction, pending] = useActionState(cancelSubscriptionAction, null);

  function confirmCancellation(event) {
    if (!window.confirm("Schedule this subscription to cancel at the end of its current billing period?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="billing-cancel-form">
      <form action={formAction} onSubmit={confirmCancellation}>
        <button
          className="ui-button ui-button-outline ui-button-sm"
          type="submit"
          name="subscriptionId"
          value={subscriptionId}
          disabled={pending}
        >
          {pending ? "Confirming…" : "Schedule cancellation"}
        </button>
      </form>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
    </div>
  );
}
