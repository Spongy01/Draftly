"use client";

// Import a .txt / .md / .docx file as a new document. The browser pre-checks type and size
// (Vercel can reject large bodies with a non-JSON 413 before they reach our route), and
// every failure ends in a readable message.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MESSAGES,
  SUPPORTED_EXTENSIONS,
  UPLOAD_MAX_BYTES,
  extensionOf,
  isSupportedExtension,
} from "@/lib/import/constants";

const GENERIC_ERROR = "Upload failed. Check the file type and size (max 2 MB) and try again.";

/** Returns the API's own message when the body is valid JSON with a string `error`, else null. */
async function apiErrorMessage(res: Response): Promise<string | null> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Not JSON (for example a platform-level 413 page): fall through to the generic message.
  }
  return null;
}

export default function ImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Reset right away so choosing the same file again fires onChange again.
    input.value = "";
    if (!file) return;

    setError(null);

    if (!isSupportedExtension(extensionOf(file.name))) {
      setError(MESSAGES.unsupported);
      return;
    }
    if (file.size === 0) {
      setError(MESSAGES.empty);
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(MESSAGES.tooLarge);
      return;
    }

    setPending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });

      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError((await apiErrorMessage(res)) ?? GENERIC_ERROR);
        setPending(false);
        return;
      }

      let id: unknown = null;
      try {
        id = (await res.json())?.id;
      } catch {
        // handled below
      }
      if (typeof id !== "string") {
        setError(GENERIC_ERROR);
        setPending(false);
        return;
      }
      router.push(`/doc/${id}`); // stay in the loading state while navigating
    } catch {
      setError(GENERIC_ERROR);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(",")}
          onChange={onFileChosen}
          className="hidden"
          aria-label="Choose a file to import"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="rounded border border-gray-500 px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import file"}
        </button>
        <span className="text-xs opacity-70">Supports .txt, .md, .docx, up to 2 MB</span>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded border border-red-500/50 px-3 py-2 text-sm text-red-600"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="leading-none"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
