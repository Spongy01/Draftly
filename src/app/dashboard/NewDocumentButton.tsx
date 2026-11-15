"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewDocumentButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error();
      const doc = await res.json();
      router.push(`/doc/${doc.id}`);
      return;
    } catch {
      setError("Could not create the document. Please try again.");
    }
    setPending(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={create}
        disabled={pending}
        className="rounded border border-gray-500 bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "New document"}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
