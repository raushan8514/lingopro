"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { updateSubscriptionPlanMetadataAction } from "@/app/admin/payment-actions";

export default function SubscriptionPlanMetadataForm({ plan }) {
  const [state, formAction, pending] = useActionState(
    updateSubscriptionPlanMetadataAction,
    null,
  );

  return (
    <details className="admin-plan-edit">
      <summary>Edit display details</summary>
      <form action={formAction} className="admin-form">
        <input type="hidden" name="planId" value={plan.id} />
        {state?.error && <Alert variant="error">{state.error}</Alert>}
        {state?.success && <Alert variant="success">{state.success}</Alert>}
        <label>
          Plan name
          <input
            className="ui-input"
            name="name"
            defaultValue={plan.name}
            required
            maxLength={120}
          />
        </label>
        <label>
          URL slug
          <input
            className="ui-input"
            name="slug"
            defaultValue={plan.slug}
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </label>
        <label>
          Description
          <textarea
            className="ui-input"
            name="description"
            defaultValue={plan.description || ""}
            rows="3"
            maxLength={2000}
          />
        </label>
        <p className="admin-form-note">
          Price, currency, interval, and cycle count are fixed for this plan.
          Create a new plan to change billing terms; saved transactions remain unchanged.
        </p>
        <button
          className="admin-button admin-button-secondary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save display details"}
        </button>
      </form>
    </details>
  );
}
