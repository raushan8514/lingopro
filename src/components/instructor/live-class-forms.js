"use client";

import { useActionState } from "react";
import {
  cancelInstructorLiveClass,
  completeInstructorLiveClass,
  createInstructorLiveClass,
  recordInstructorLiveClassAttendance,
} from "@/app/instructor/live-classes/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

const INITIAL_STATE = { error: "", success: "" };

function Feedback({ state }) {
  if (state.error) return <p className="instructor-form-message is-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="instructor-form-message is-success" role="status">{state.success}</p>;
  return null;
}

export function InstructorLiveClassCreateForm({ courses }) {
  const [state, action, pending] = useActionState(
    createInstructorLiveClass,
    INITIAL_STATE,
  );
  return (
    <form className="instructor-live-class-form" action={action}>
      <Select label="Published course" name="course_id" required defaultValue="">
        <option value="" disabled>Choose a course</option>
        {courses.map((course) => (
          <option value={course.id} key={course.id}>{course.title}</option>
        ))}
      </Select>
      <Input label="Session title" name="title" maxLength={180} required />
      <Textarea label="Description" name="description" rows={3} maxLength={2000} />
      <div className="instructor-live-class-form-grid">
        <Input
          label="Start time (UTC)"
          name="scheduled_start"
          type="datetime-local"
          required
        />
        <Input
          label="End time (UTC)"
          name="scheduled_end"
          type="datetime-local"
          required
        />
      </div>
      <div className="instructor-live-class-form-grid">
        <Select label="Meeting provider" name="meeting_provider" defaultValue="EXTERNAL">
          <option value="EXTERNAL">Other external host</option>
          <option value="ZOOM">Zoom (host-created)</option>
          <option value="GOOGLE_MEET">Google Meet (host-created)</option>
          <option value="OTHER">Another provider</option>
        </Select>
        <Input
          label="Capacity (optional)"
          name="max_participants"
          type="number"
          min="1"
          max="1000"
          placeholder="Unlimited"
        />
      </div>
      <Input
        label="Host-provided HTTPS meeting link"
        name="meeting_reference"
        type="url"
        placeholder="https://"
        maxLength={2048}
        required
        hint="LingoPro does not create or verify provider meetings. Registered students will see this link as host-provided."
      />
      <Feedback state={state} />
      <Button type="submit" loading={pending} disabled={!courses.length}>
        Schedule live class
      </Button>
      {!courses.length && (
        <p className="instructor-form-message">
          Publish a course before scheduling a live class.
        </p>
      )}
    </form>
  );
}

export function InstructorLiveClassLifecycleForm({ liveClass, canComplete }) {
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelInstructorLiveClass,
    INITIAL_STATE,
  );
  const [completeState, completeAction, completing] = useActionState(
    completeInstructorLiveClass,
    INITIAL_STATE,
  );
  return (
    <div className="instructor-live-class-actions">
      {liveClass.status === "SCHEDULED" && (
        <>
          <form action={completeAction}>
            <input type="hidden" name="live_class_id" value={liveClass.id} />
            <Button
              type="submit"
              variant="outline"
              loading={completing}
              disabled={!canComplete}
            >
              Mark complete
            </Button>
            <Feedback state={completeState} />
          </form>
          <form
            action={cancelAction}
            onSubmit={(event) => {
              if (!window.confirm("Cancel this class? Registered students will be notified.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="live_class_id" value={liveClass.id} />
            <Button type="submit" variant="destructive" loading={cancelling}>
              Cancel class
            </Button>
            <Feedback state={cancelState} />
          </form>
        </>
      )}
    </div>
  );
}

export function InstructorAttendanceForm({ liveClassId, studentId, studentName }) {
  const [state, action, pending] = useActionState(
    recordInstructorLiveClassAttendance,
    INITIAL_STATE,
  );
  return (
    <form className="instructor-attendance-form" action={action}>
      <input type="hidden" name="live_class_id" value={liveClassId} />
      <input type="hidden" name="student_id" value={studentId} />
      <span className="instructor-live-class-attendee">{studentName}</span>
      <div>
        <Button
          type="submit"
          name="attendance_result"
          value="ATTENDED"
          variant="outline"
          loading={pending}
        >
          Attended
        </Button>
        <Button
          type="submit"
          name="attendance_result"
          value="NO_SHOW"
          variant="ghost"
          disabled={pending}
        >
          No show
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
