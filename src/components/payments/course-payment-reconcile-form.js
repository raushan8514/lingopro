"use client";

import { useActionState } from "react";
import { reconcileCoursePaymentAction } from "@/lib/payments/actions";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function CoursePaymentReconcileForm({ paymentId }) {
  const [state, formAction, pending] = useActionState(
    reconcileCoursePaymentAction,
    null,
  );

  return (
    <div className="billing-reconcile-control">
      <form action={formAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <Button type="submit" variant="outline" size="sm" loading={pending} disabled={pending}>
          {pending ? "Checking…" : "Check payment status"}
        </Button>
      </form>
      {state?.message && (
        <Alert variant={state.success ? "success" : state.pending ? "warning" : "information"}>
          {state.message}
        </Alert>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
    </div>
  );
}
