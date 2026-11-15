"use client";

// Autosave hook: drives the pure state machine in ./autosave.ts with a debounce and fetch.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  displayStatus,
  hasUnsaved,
  initialState,
  recordEdit,
  sendBlocked,
  sendFailed,
  sendSucceeded,
  shouldSend,
  startSend,
  type AutosaveState,
  type BlockReason,
  type SaveStatus,
} from "./autosave";

const DEBOUNCE_MS = 1000;

export function useAutosave(docId: string, enabled: boolean) {
  const router = useRouter();
  const stateRef = useRef<AutosaveState>(initialState());
  const [view, setView] = useState<{
    status: SaveStatus;
    error: string | null;
    blocked: BlockReason | null;
  }>({ status: "idle", error: null, blocked: null });
  const latestHtml = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const apply = useCallback((next: AutosaveState) => {
    stateRef.current = next;
    setView({ status: displayStatus(next), error: next.error, blocked: next.blocked });
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!enabled || latestHtml.current === null) return;
    if (!shouldSend(stateRef.current)) return;

    const html = latestHtml.current;
    const started = startSend(stateRef.current);
    apply(started.state);

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHtml: html }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403 || res.status === 404) {
        // Access was downgraded (403) or removed (404): stop for good, keep the text on screen.
        apply(sendBlocked(stateRef.current, started.seq, res.status === 403 ? "forbidden" : "gone"));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        apply(sendFailed(stateRef.current, started.seq, data?.error ?? "Could not save your changes."));
        return;
      }
      apply(sendSucceeded(stateRef.current, started.seq));
    } catch {
      apply(sendFailed(stateRef.current, started.seq, "Network error. Your changes are not saved."));
      return;
    }

    // Edits made while this request was in flight: send them now (single follow-up).
    if (shouldSend(stateRef.current)) void flushRef.current();
  }, [apply, docId, enabled, router]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Call on every editor change with the editor's current HTML. */
  const notifyEdit = useCallback(
    (html: string) => {
      if (!enabled) return;
      latestHtml.current = html;
      apply(recordEdit(stateRef.current));
      clearTimeout(timer.current);
      if (stateRef.current.blocked) return; // access lost: don't schedule more saves
      timer.current = setTimeout(() => void flushRef.current(), DEBOUNCE_MS);
    },
    [apply, enabled],
  );

  const retry = useCallback(() => void flushRef.current(), []);

  // Warn on hard unloads / tab close while there are unsaved changes.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved(stateRef.current)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  // Leaving the page in-app (e.g. "Back to dashboard"): try one last normal save.
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      void flushRef.current();
    };
  }, []);

  return { status: view.status, error: view.error, blocked: view.blocked, notifyEdit, flush: retry };
}
