"use client";

import { useActionState } from "react";
import {
  moderateAdminCourse,
  reviewAdminAssessmentAttempt,
  revokeAdminCertificate,
  saveAdminCategory,
  saveAdminSetting,
  setAdminUserRole,
  unpublishAdminAssessment,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form-controls";

const INITIAL_STATE = { error: "", success: "" };

function Feedback({ state }) {
  if (state.error) return <p className="admin-form-feedback is-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-form-feedback is-success" role="status">{state.success}</p>;
  return null;
}

export function AdminRoleForm({ user, currentUserId }) {
  const [state, action, pending] = useActionState(setAdminUserRole, INITIAL_STATE);
  const isSelf = user.id === currentUserId;
  function confirmRoleChange(event) {
    const role = new FormData(event.currentTarget).get("role");
    if (role !== user.role && !window.confirm(`Change ${user.full_name}'s role to ${role}? This will be recorded in the audit log.`)) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} className="admin-inline-form" onSubmit={confirmRoleChange}>
      <input type="hidden" name="user_id" value={user.id} />
      <Select label="Account role" name="role" defaultValue={user.role} disabled={isSelf}>
        <option value="student">Student</option>
        <option value="instructor">Instructor</option>
        <option value="admin">Administrator</option>
      </Select>
      <Button type="submit" variant="outline" loading={pending} disabled={isSelf}>
        Update role
      </Button>
      {isSelf && <p className="admin-form-note">You cannot change your own privileged role.</p>}
      <Feedback state={state} />
    </form>
  );
}

export function AdminCourseModerationForm({ course }) {
  const [state, action, pending] = useActionState(moderateAdminCourse, INITIAL_STATE);
  function confirmDecision(event) {
    const decision = event.nativeEvent.submitter?.value;
    if (
      ["archive", "return"].includes(decision) &&
      !window.confirm(`Confirm ${decision === "archive" ? "archiving" : "returning this course for correction"}? The decision is logged.`)
    ) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} className="admin-moderation-form" onSubmit={confirmDecision}>
      <input type="hidden" name="course_id" value={course.id} />
      <Textarea
        label="Decision note"
        name="reason"
        rows={3}
        minLength={3}
        maxLength={1000}
        required
        hint="This note is retained in the administrative audit history."
      />
      <Feedback state={state} />
      <div className="admin-action-row">
        {["DRAFT", "PENDING_REVIEW"].includes(course.status) && (
          <Button type="submit" name="moderation_action" value="publish" loading={pending}>
            Publish course
          </Button>
        )}
        {course.status === "PENDING_REVIEW" && (
          <Button type="submit" name="moderation_action" value="return" variant="outline" disabled={pending}>
            Return for correction
          </Button>
        )}
        {course.status !== "ARCHIVED" && (
          <Button type="submit" name="moderation_action" value="archive" variant="destructive" disabled={pending}>
            Archive course
          </Button>
        )}
        {course.status === "ARCHIVED" && (
          <Button type="submit" name="moderation_action" value="restore" variant="outline" loading={pending}>
            Restore as draft
          </Button>
        )}
      </div>
      <p className="admin-form-note">Publishing changes catalog visibility. Archiving preserves enrollments and learning records.</p>
    </form>
  );
}

export function AdminAssessmentModerationForm({ assessment }) {
  const [state, action, pending] = useActionState(unpublishAdminAssessment, INITIAL_STATE);
  function confirmUnpublish(event) {
    if (!window.confirm("Unpublish this assessment? Existing learner attempts will remain unchanged.")) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} className="admin-moderation-form" onSubmit={confirmUnpublish}>
      <input type="hidden" name="assessment_id" value={assessment.id} />
      <Textarea
        label="Moderation reason"
        name="reason"
        rows={3}
        minLength={3}
        maxLength={1000}
        required
      />
      <Feedback state={state} />
      <Button type="submit" variant="destructive" loading={pending} disabled={!assessment.is_published}>
        Unpublish assessment
      </Button>
      <p className="admin-form-note">Existing learner attempts and grading records are not modified.</p>
    </form>
  );
}

export function AdminAttemptReviewForm({ assessmentId, attempt }) {
  const [state, action, pending] = useActionState(
    reviewAdminAssessmentAttempt,
    INITIAL_STATE,
  );
  return (
    <form action={action} className="admin-attempt-review-form">
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <input type="hidden" name="attempt_id" value={attempt.attempt_id} />
      <Textarea
        label="Manual review note"
        name="review_note"
        rows={2}
        minLength={3}
        maxLength={1000}
        defaultValue={attempt.review_note || ""}
        required
        hint="This note is retained in the administrator review history. No automatic suspicion rules are applied."
      />
      <Feedback state={state} />
      <div className="admin-action-row">
        <Button
          type="submit"
          name="review_status"
          value="FLAGGED"
          variant="destructive"
          loading={pending}
        >
          Flag for follow-up
        </Button>
        {attempt.review_status === "FLAGGED" && (
          <Button
            type="submit"
            name="review_status"
            value="CLEARED"
            variant="outline"
            disabled={pending}
          >
            Clear flag
          </Button>
        )}
      </div>
    </form>
  );
}

export function AdminCertificateRevocationForm({ certificate }) {
  const [state, action, pending] = useActionState(
    revokeAdminCertificate,
    INITIAL_STATE,
  );
  return (
    <form
      action={action}
      className="admin-moderation-form"
      onSubmit={(event) => {
        if (!window.confirm("Revoke this certificate? The action and reason will be retained in the audit history.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="certificate_id" value={certificate.id} />
      <Textarea
        label="Revocation reason"
        name="reason"
        rows={2}
        minLength={10}
        maxLength={1000}
        required
      />
      <Feedback state={state} />
      <Button type="submit" variant="destructive" loading={pending}>
        Revoke certificate
      </Button>
    </form>
  );
}

export function AdminCategoryForm({ category = null }) {
  const [state, action, pending] = useActionState(saveAdminCategory, INITIAL_STATE);
  function confirmDeactivation(event) {
    const active = new FormData(event.currentTarget).getAll("is_active").includes("true");
    if (category?.is_active && !active && category.courseCount > 0 && !window.confirm(`Deactivate this category used by ${category.courseCount} courses? Existing assignments will remain.`)) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} className="admin-form" onSubmit={confirmDeactivation}>
      {category && <input type="hidden" name="category_id" value={category.id} />}
      <div className="admin-form-grid">
        <Input label="Category name" name="name" defaultValue={category?.name || ""} maxLength={100} required />
        <Input label="URL slug" name="slug" defaultValue={category?.slug || ""} maxLength={100} required hint="Lowercase letters, numbers, and hyphens." />
        <Input label="Image URL" name="image_url" type="url" defaultValue={category?.image_url || ""} placeholder="https://" />
      </div>
      <Textarea label="Description" name="description" rows={3} maxLength={2000} defaultValue={category?.description || ""} />
      <input type="hidden" name="is_active" value="false" />
      <Checkbox
        name="is_active"
        value="true"
        label="Category is active"
        description="Inactive categories are hidden from public category listings."
        defaultChecked={category?.is_active ?? true}
      />
      <Feedback state={state} />
      <Button type="submit" loading={pending}>{category ? "Save category" : "Create category"}</Button>
    </form>
  );
}

export function AdminSettingForm({ setting = null }) {
  const [state, action, pending] = useActionState(saveAdminSetting, INITIAL_STATE);
  function confirmPublicSetting(event) {
    const isPublic = new FormData(event.currentTarget).getAll("is_public").includes("true");
    if (isPublic && !setting?.is_public && !window.confirm("Make this setting visible to anonymous visitors? Confirm its value contains no private data.")) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} className="admin-form admin-setting-form" onSubmit={confirmPublicSetting}>
      <Input
        label="Setting key"
        name="setting_key"
        defaultValue={setting?.setting_key || ""}
        maxLength={100}
        required
        pattern="[a-z][a-z0-9_.-]{1,99}"
        hint="No credentials, secrets, payment settings, or tokens."
      />
      <Textarea
        label="Value (JSON)"
        name="setting_value"
        rows={4}
        maxLength={10000}
        required
        defaultValue={setting ? JSON.stringify(setting.setting_value, null, 2) : "null"}
        hint="Only settings explicitly read by the application affect runtime behavior."
      />
      <Input label="Description" name="description" maxLength={500} defaultValue={setting?.description || ""} />
      <input type="hidden" name="is_public" value="false" />
      <Checkbox
        name="is_public"
        value="true"
        label="Public setting"
        description="Public settings are readable by anonymous visitors. Never store private data here."
        defaultChecked={setting?.is_public || false}
      />
      <Feedback state={state} />
      <Button type="submit" loading={pending}>{setting ? "Save setting" : "Add setting"}</Button>
    </form>
  );
}
