"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import { saveInstructorCourseCover } from "@/app/instructor/actions";
import { createClient } from "@/lib/supabase/client";

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function CourseCoverUploader({ courseId, currentUrl }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function uploadCover(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setMessage("");
    setErrorMessage("");
    const extension = imageExtensions[file.type];
    if (!extension) {
      setErrorMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Course cover images must be 5 MB or smaller.");
      return;
    }

    const uploadedPreview = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return uploadedPreview;
    });

    startTransition(async () => {
      const path = `${courseId}/${crypto.randomUUID()}.${extension}`;
      let client;
      try {
        client = createClient();
        const { error: uploadError } = await client.storage
          .from("course-thumbnails")
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: "3600",
          });
        if (uploadError) {
          console.error("Unable to upload the course cover.", {
            code: uploadError.code,
            status: uploadError.statusCode,
          });
          setErrorMessage("The course cover could not be uploaded. Try again.");
          setPreviewUrl("");
          return;
        }

        const result = await saveInstructorCourseCover(courseId, path);
        if (result?.error) {
          const { error: cleanupError } = await client.storage
            .from("course-thumbnails")
            .remove([path]);
          if (cleanupError) {
            console.error("Unable to remove an unlinked course cover.", {
              name: cleanupError.name,
              status: cleanupError.statusCode,
            });
          }
          setErrorMessage(result.error);
          setPreviewUrl("");
          return;
        }

        if (result.previousStoragePath) {
          const { error: removeError } = await client.storage
            .from("course-thumbnails")
            .remove([result.previousStoragePath]);
          if (removeError) {
            console.error("Unable to remove the previous course cover.", {
              name: removeError.name,
              status: removeError.statusCode,
            });
            setMessage("Cover updated. The previous image could not be removed.");
            router.refresh();
            return;
          }
        }

        setMessage(result.success || "Course cover updated.");
        router.refresh();
      } catch (error) {
        console.error("Unable to save the course cover.", {
          name: error?.name,
          status: error?.status,
        });
        setErrorMessage("The course cover could not be saved. Check your connection and try again.");
        setPreviewUrl("");
      }
    });
  }

  return (
    <div className="instructor-course-cover-uploader">
      <div className="instructor-course-cover-preview">
        {(previewUrl || currentUrl) && (
          // Course covers are public catalog images, and their URLs are validated before storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl || currentUrl}
            alt="Course cover preview"
          />
        )}
        {!previewUrl && !currentUrl && (
          <span aria-hidden="true"><Camera size={24} /></span>
        )}
      </div>
      <div>
        <label className="ui-button ui-button-secondary ui-button-sm" htmlFor={`course-cover-${courseId}`}>
          {pending ? <LoaderCircle className="ui-spinner-icon" size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
          {pending ? "Uploading…" : "Upload course cover"}
        </label>
        <input
          id={`course-cover-${courseId}`}
          className="instructor-course-cover-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadCover}
          disabled={pending}
          aria-describedby={`course-cover-help-${courseId}`}
        />
        <p id={`course-cover-help-${courseId}`} className="instructor-form-help">
          JPG, PNG, or WebP up to 5 MB. Images are stored in the public course-cover bucket.
        </p>
        {errorMessage && <p className="instructor-form-message is-error" role="alert">{errorMessage}</p>}
        {message && <p className="instructor-form-message is-success" role="status">{message}</p>}
      </div>
    </div>
  );
}
