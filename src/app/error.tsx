"use client";

import { ErrorState } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState message="לא הצלחנו לטעון את העמוד. אפשר לנסות שוב.">
      <Button onClick={reset}>ניסיון נוסף</Button>
    </ErrorState>
  );
}
