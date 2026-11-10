"use client";

import { useActionState } from "react";
import { setSubscriptionPlanActiveAction } from "@/app/admin/payment-actions";
import { Alert } from "@/components/ui/feedback";

export default function SubscriptionPlanDeactivateForm({ planId, active }) {
  const [state, formAction, pending] = useActionState(
    setSubscriptionPlanActiveAction,
    null,
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="planId" value={planId} />
        <input
          type="hidden"
          name="targetStatus"
          value={active ? "inactive" : "active"}
        />
        <button
          className={`admin-button ${active ? "admin-button-secondary" : "admin-button-primary"}`}
          type="submit"
          disabled={pending}
        >
          {pending
            ? active ? "Deactivating…" : "Activating…"
            : active ? "Deactivate" : "Activate"}
        </button>
      </form>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
    </div>
  );
}
