"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ActionLink from "@/components/landing/action-link";
import RazorpayCheckoutButton from "@/components/payments/razorpay-checkout-button";
import { enrollInFreeCourseAction } from "@/app/(marketplace)/courses/actions";

export default function EnrollmentAction({
  course,
  authStatus,
  role,
  enrollment,
  enrollmentStatus,
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    enrollInFreeCourseAction,
    null,
  );

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [router, state]);

  if (enrollmentStatus === "unavailable") {
    return (
      <Alert variant="warning" title="Enrollment status unavailable">
        Refresh the page before enrolling so we can confirm your current access.
      </Alert>
    );
  }

  if (enrollment?.status === "ACTIVE") {
    return (
      <div className="market-enrolled-state">
        <Badge variant="success">You’re enrolled</Badge>
        <p>Your course access is active.</p>
        <Link className="market-text-action" href="/student">
          Go to your learning space
        </Link>
      </div>
    );
  }

  if (enrollment?.status === "COMPLETED") {
    return (
      <div className="market-enrolled-state">
        <Badge variant="success">Course completed</Badge>
        <p>You’ve completed this course.</p>
      </div>
    );
  }

  if (course.price_cents > 0) {
    if (authStatus === "unavailable" || authStatus === "profile-unavailable") {
      return (
        <Alert variant="warning" title="Account verification unavailable">
          Please try again later. We can’t safely confirm your account before checkout.
        </Alert>
      );
    }
    if (authStatus !== "authenticated") {
      return (
        <ActionLink href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>
          Log in to purchase
        </ActionLink>
      );
    }
    if (role !== "student") {
      return (
        <Alert variant="information" title="Student account required">
          Course purchases are available to student accounts.
        </Alert>
      );
    }
    return (
      <div className="market-purchase-notice">
        <RazorpayCheckoutButton
          kind="course"
          targetId={course.id}
          label="Purchase course"
        />
        <span>One-time payment. Access is enabled only after server verification.</span>
      </div>
    );
  }

  if (authStatus === "unavailable" || authStatus === "profile-unavailable") {
    return (
      <Alert variant="warning" title="Account verification unavailable">
        Please try again later. We can’t safely confirm enrollment without your account status.
      </Alert>
    );
  }

  if (!role && authStatus !== "authenticated") {
    return (
      <ActionLink href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>
        Log in to enroll
      </ActionLink>
    );
  }

  if (role !== "student") {
    return (
      <Alert variant="information" title="Student account required">
        Course enrollment is available to student accounts.
      </Alert>
    );
  }

  return (
    <div className="market-enrollment-action">
      <form action={formAction}>
        <input type="hidden" name="courseSlug" value={course.slug} />
        <Button type="submit" loading={pending} className="market-enroll-button">
          {pending ? "Enrolling…" : "Enroll for free"}
        </Button>
      </form>
      {state?.error && (
        <Alert variant="error" className="market-enrollment-message">
          {state.error}
        </Alert>
      )}
      {state?.message && (
        <Alert variant="success" className="market-enrollment-message">
          {state.message}
        </Alert>
      )}
    </div>
  );
}
