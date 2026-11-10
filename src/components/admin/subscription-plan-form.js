"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { createSubscriptionPlanAction } from "@/app/admin/payment-actions";

const initialState = null;

export default function SubscriptionPlanForm() {
  const [state, formAction, pending] = useActionState(
    createSubscriptionPlanAction,
    initialState,
  );

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <div className="admin-form-grid">
        <label>
          Plan name
          <input className="ui-input" name="name" required maxLength={120} />
        </label>
        <label>
          URL slug
          <input
            className="ui-input"
            name="slug"
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="monthly-learning"
          />
        </label>
        <label>
          Price in minor units
          <input className="ui-input" name="price_cents" type="number" min="1" step="1" required />
        </label>
        <label>
          Currency
          <input
            className="ui-input"
            name="currency"
            required
            minLength={3}
            maxLength={3}
            pattern="[A-Za-z]{3}"
            placeholder="INR"
          />
        </label>
        <label>
          Billing interval
          <select className="ui-input ui-select" name="billing_interval" defaultValue="MONTH">
            <option value="MONTH">Monthly</option>
            <option value="YEAR">Annual</option>
          </select>
        </label>
        <label>
          Interval count
          <input className="ui-input" name="interval_count" type="number" min="1" step="1" defaultValue="1" required />
        </label>
        <label>
          Total billing cycles
          <input className="ui-input" name="billing_cycles" type="number" min="1" step="1" required />
        </label>
        <label className="admin-form-grid-wide">
          Description
          <textarea className="ui-input" name="description" rows="3" maxLength={2000} />
        </label>
      </div>
      <p className="admin-form-note">
        The cycle count controls when recurring billing ends. New plans are
        saved inactive and must be explicitly activated after terms are reviewed.
        Existing plans and transaction amounts are never repriced by this form.
      </p>
      <button className="admin-button admin-button-primary" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}
