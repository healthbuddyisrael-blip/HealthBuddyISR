"use client";
import { useLinkStatus } from "next/link";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="text-xs">
      טוען…
    </span>
  ) : null;
}
