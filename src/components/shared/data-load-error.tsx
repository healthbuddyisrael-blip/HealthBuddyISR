"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "./feedback";
import { Button } from "@/components/ui/button";

export function DataLoadError({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState message={message}>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "טוענים…" : "ניסיון נוסף"}
      </Button>
    </ErrorState>
  );
}
