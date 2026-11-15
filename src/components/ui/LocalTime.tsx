"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Formats an ISO timestamp in the browser's timezone.
 * Server render (and hydration) uses an empty placeholder via getServerSnapshot,
 * so there is no hydration mismatch; the real value appears right after hydration.
 */
export default function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    () => "",
  );
  return (
    <time dateTime={iso} className="inline-block min-w-[9ch]">
      {text}
    </time>
  );
}
