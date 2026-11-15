"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "saving" | "saved" | "error";

export default function RenameTitle({
  docId,
  initialTitle,
  canEdit,
}: {
  docId: string;
  initialTitle: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialTitle); // last title confirmed by the server
  const [value, setValue] = useState(initialTitle);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!canEdit) {
    return <h1 className="text-2xl font-semibold">{saved}</h1>;
  }

  async function commit() {
    if (value.trim() === saved && status !== "error") {
      setValue(saved);
      return;
    }
    clearTimeout(timer.current);
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setError(data?.fields?.title ?? data?.error ?? "Could not save the title.");
        return;
      }
      setSaved(data.title);
      setValue(data.title);
      setStatus("saved");
      router.refresh();
      timer.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <input
          aria-label="Document title"
          value={value}
          maxLength={200}
          onChange={(e) => {
            setValue(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setError(null);
            }
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setValue(saved);
              setStatus("idle");
              setError(null);
            }
          }}
          className="rounded border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold hover:border-gray-400 focus:border-gray-500 focus:outline-none"
        />
        <span aria-live="polite" className="text-xs opacity-70">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 px-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
