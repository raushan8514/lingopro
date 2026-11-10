"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form-controls";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/app/auth/actions";

function SubmitButton({ children, pendingLabel }) {
  const { pending } = useFormStatus();

  return (
    <Button className="auth-submit" type="submit" loading={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function FormFeedback({ state }) {
  if (state?.error) {
    return <p className="auth-feedback auth-feedback-error" role="alert">{state.error}</p>;
  }
  if (state?.message) {
    return <p className="auth-feedback auth-feedback-success" role="status">{state.message}</p>;
  }
  return null;
}

function PasswordField({ id, name, label, error, autoComplete, hint }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-password-wrap">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        label={label}
        error={error}
        hint={hint}
        autoComplete={autoComplete}
        required
      />
      <button
        className="auth-password-toggle"
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginForm({ nextPath = "" }) {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <form className="auth-form" action={formAction} noValidate>
      <input type="hidden" name="next" value={nextPath} />
      <FormFeedback state={state} />
      <Input
        id="login-email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email}
        required
      />
      <PasswordField
        id="login-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        error={state?.errors?.password}
      />
      <div className="auth-form-meta">
        <span className="auth-meta-note">Your secure session refreshes as you use LingoPro.</span>
        <a href="/forgot-password">Forgot password?</a>
      </div>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null);

  return (
    <form className="auth-form" action={formAction} noValidate>
      <FormFeedback state={state} />
      <Input
        id="register-full-name"
        name="fullName"
        label="Full name"
        placeholder="Your name"
        autoComplete="name"
        maxLength={120}
        error={state?.errors?.fullName}
        required
      />
      <Input
        id="register-email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email}
        required
      />
      <PasswordField
        id="register-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        hint="Use at least 8 characters."
        error={state?.errors?.password}
      />
      <PasswordField
        id="register-confirm-password"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        error={state?.errors?.confirmPassword}
      />
      <div className="auth-terms">
        <Checkbox
          id="register-terms"
          name="termsAccepted"
          label="I agree to LingoPro's terms and privacy notice."
          required
        />
        {state?.errors?.termsAccepted && (
          <p className="auth-field-error" role="alert">{state.errors.termsAccepted}</p>
        )}
      </div>
      <SubmitButton pendingLabel="Creating account…">Create student account</SubmitButton>
      <p className="auth-form-note">
        New public accounts are always created with the student role.
      </p>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(resendVerificationAction, null);

  return (
    <form className="auth-form auth-resend-form" action={formAction} noValidate>
      <FormFeedback state={state} />
      <Input
        id="verification-email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email}
        required
      />
      <SubmitButton pendingLabel="Sending…">Resend verification email</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, null);

  return (
    <form className="auth-form" action={formAction} noValidate>
      <FormFeedback state={state} />
      <Input
        id="recovery-email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        error={state?.errors?.email}
        required
      />
      <SubmitButton pendingLabel="Sending instructions…">Send reset instructions</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, null);

  return (
    <form className="auth-form" action={formAction} noValidate>
      <FormFeedback state={state} />
      <PasswordField
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        hint="Use at least 8 characters."
        error={state?.errors?.password}
      />
      <PasswordField
        id="reset-confirm-password"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        error={state?.errors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Updating password…">Update password</SubmitButton>
    </form>
  );
}
