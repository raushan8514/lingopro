"use client";

import { useActionState } from "react";
import {
  cancelStudentLiveClassRegistration,
  registerStudentForLiveClass,
} from "@/app/student/actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE = { error: "", success: "" };

function Feedback({ state }) {
  if (state.error) return <p className="student-form-message is-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="student-form-message is-success" role="status">{state.success}</p>;
  return null;
}

export function StudentLiveClassRegistrationForm({ liveClassId, registration }) {
  const [registerState, registerAction, registering] = useActionState(
    registerStudentForLiveClass,
    INITIAL_STATE,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelStudentLiveClassRegistration,
    INITIAL_STATE,
  );

  if (registration?.registration_status === "REGISTERED") {
    return (
      <div className="student-live-class-registration">
        <p className="student-form-message is-success" role="status">
          You are registered for this class.
        </p>
        <form
          action={cancelAction}
          onSubmit={(event) => {
            if (!window.confirm("Cancel your registration for this class?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="live_class_id" value={liveClassId} />
          <Button type="submit" variant="outline" loading={cancelling}>
            Cancel registration
          </Button>
          <Feedback state={cancelState} />
        </form>
      </div>
    );
  }

  return (
    <form className="student-live-class-registration" action={registerAction}>
      <input type="hidden" name="live_class_id" value={liveClassId} />
      <Feedback state={registerState} />
      <Button type="submit" loading={registering}>
        {registration?.registration_status === "CANCELLED"
          ? "Register again"
          : "Register"}
      </Button>
    </form>
  );
}
