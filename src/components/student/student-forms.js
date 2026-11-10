"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, LoaderCircle } from "lucide-react";
import {
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
  saveStudentAvatarPath,
  saveStudentLearningGoals,
  saveStudentNotificationPreferences,
  saveStudentProfile,
} from "@/app/student/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";

const initialState = { error: "", success: "" };

function ActionMessage({ state }) {
  if (state.error) {
    return <p className="student-form-message is-error" role="alert">{state.error}</p>;
  }
  if (state.success) {
    return <p className="student-form-message is-success" role="status">{state.success}</p>;
  }
  return null;
}

export function StudentProfileForm({ fullName }) {
  const [state, action, pending] = useActionState(saveStudentProfile, initialState);

  return (
    <form className="student-settings-form" action={action}>
      <Input
        label="Full name"
        name="full_name"
        defaultValue={fullName}
        autoComplete="name"
        minLength={1}
        maxLength={120}
        required
      />
      <p className="student-form-help">
        Your name is shown in your learning workspace. Account role and sign-in email are managed separately.
      </p>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending} leftIcon={<Check size={16} aria-hidden="true" />}>
        Save profile
      </Button>
    </form>
  );
}

export function StudentLearningGoalsForm({ goals }) {
  const [state, action, pending] = useActionState(
    saveStudentLearningGoals,
    initialState,
  );

  return (
    <form className="student-settings-form" action={action}>
      <div className="student-form-grid">
        <Input
          label="Daily lesson target"
          name="daily_lesson_target"
          type="number"
          min="1"
          max="20"
          defaultValue={goals.daily_lesson_target}
          required
        />
        <Input
          label="Weekly lesson target"
          name="weekly_lesson_target"
          type="number"
          min="1"
          max="100"
          defaultValue={goals.weekly_lesson_target}
          required
        />
      </div>
      <Input
        label="Timezone"
        name="timezone"
        defaultValue={goals.timezone}
        maxLength={64}
        placeholder="America/Los_Angeles"
        hint="Use an IANA timezone, for example Europe/Paris or America/New_York."
        required
      />
      <Input
        label="Preferred learning language"
        name="preferred_language"
        defaultValue={goals.preferred_language || ""}
        maxLength={80}
        placeholder="Spanish"
        hint="Optional. This preference does not change course access or catalog results."
      />
      <ActionMessage state={state} />
      <Button type="submit" loading={pending} leftIcon={<Check size={16} aria-hidden="true" />}>
        Save learning preferences
      </Button>
    </form>
  );
}

export function StudentNotificationPreferencesForm({ preferences }) {
  const [state, action, pending] = useActionState(
    saveStudentNotificationPreferences,
    initialState,
  );
  const options = [
    ["course_updates", "Course access and completion", "Enrollment and course-completion updates."],
    ["assessment_updates", "Assessment results", "When an assessment receives a graded result."],
    ["certificate_updates", "Certificates", "When a course certificate is issued."],
    ["live_class_updates", "Live classes", "Registration confirmations and schedule changes."],
    ["billing_updates", "Billing", "Subscription and payment lifecycle updates."],
  ];

  return (
    <form className="student-settings-form" action={action}>
      <div className="student-notification-preferences">
        {options.map(([name, label, description]) => (
          <label className="student-notification-preference" key={name}>
            <input
              type="checkbox"
              name={name}
              value="true"
              defaultChecked={preferences[name]}
            />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      <ActionMessage state={state} />
      <Button type="submit" loading={pending} leftIcon={<Check size={16} aria-hidden="true" />}>
        Save notification preferences
      </Button>
      <p className="student-form-help">
        These controls apply to in-app messages. Email and push delivery are not
        enabled because no delivery provider is configured.
      </p>
    </form>
  );
}

export function StudentAvatarUploader({
  studentId,
  currentPath,
}) {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function uploadAvatar(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setMessage("");
    setErrorMessage("");
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];

    if (!extension) {
      setErrorMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Profile images must be 5 MB or smaller.");
      return;
    }

    startTransition(async () => {
      const path = `${studentId}/profile-avatar.${extension}`;
      const client = createClient();
      const { error: uploadError } = await client.storage
        .from("user-avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Unable to upload the private profile image.", {
          code: uploadError.code,
          status: uploadError.statusCode,
        });
        setErrorMessage("The profile image could not be uploaded. Try again.");
        return;
      }

      const result = await saveStudentAvatarPath(path);
      if (result?.error) {
        const { error: cleanupError } = await client.storage
          .from("user-avatars")
          .remove([path]);
        if (cleanupError) {
          console.error("Unable to remove an unlinked profile image.", {
            code: cleanupError.name,
            status: cleanupError.statusCode,
          });
        }
        setErrorMessage(result.error);
        return;
      }

      if (currentPath && currentPath !== path) {
        const { error: removeError } = await client.storage
          .from("user-avatars")
          .remove([currentPath]);
        if (removeError) {
          console.error("Unable to remove the previous profile image.", {
            code: removeError.name,
            status: removeError.statusCode,
          });
          setMessage("Image updated. The previous private file could not be removed.");
          router.refresh();
          return;
        }
      }

      setMessage(result?.success || "Profile image updated.");
      router.refresh();
    });
  }

  return (
    <div className="student-avatar-uploader">
      <label className="student-avatar-upload-button">
        <Camera size={16} aria-hidden="true" />
        <span>{pending ? "Uploading…" : "Change photo"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadAvatar}
          disabled={pending}
          aria-label="Upload a profile image"
        />
      </label>
      {pending && <LoaderCircle className="student-upload-spinner" size={17} aria-label="Uploading image" />}
      {errorMessage && <p className="student-form-message is-error" role="alert">{errorMessage}</p>}
      {message && <p className="student-form-message is-success" role="status">{message}</p>}
    </div>
  );
}

export function MarkNotificationReadButton({ notificationId }) {
  return (
    <form action={markStudentNotificationRead}>
      <input type="hidden" name="notification_id" value={notificationId} />
      <button className="student-mark-read" type="submit">
        Mark as read
      </button>
    </form>
  );
}

export function MarkAllNotificationsReadButton() {
  return (
    <form action={markAllStudentNotificationsRead}>
      <Button type="submit" variant="outline" size="sm">
        Mark all as read
      </Button>
    </form>
  );
}
