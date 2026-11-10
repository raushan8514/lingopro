"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function StudentError({ error, reset }) {
  useEffect(() => {
    console.error("The student workspace could not be rendered.", error);
  }, [error]);

  return (
    <main className="student-page student-error-page">
      <Alert variant="error" title="Learning data is temporarily unavailable">
        Your account remains protected. Try again, and contact support if this continues.
      </Alert>
      <Button type="button" onClick={reset}>Try again</Button>
    </main>
  );
}
