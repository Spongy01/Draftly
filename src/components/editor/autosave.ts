// Pure autosave state machine (no React, no fetch). The hook drives it; tests exercise it directly.
//
// Rules:
// - At most one save request is in flight at a time, so responses cannot arrive out of order.
// - Every local edit bumps `editVersion`. A save remembers the request `seq` it was started with.
// - A response only counts if its `seq` matches the current in-flight request (stale ones are ignored).
// - "Saved" is shown only when the server confirmed a request and no newer edits exist.
// - A 403/404 on save means access was lost. That is terminal ("blocked"): nothing is sent again,
//   so there is no retry loop, and the unsaved text stays in the editor so it can be copied out.

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "blocked";

/** forbidden = 403 (access downgraded to viewer); gone = 404 (access removed entirely). */
export type BlockReason = "forbidden" | "gone";

export const BLOCKED_MESSAGES: Record<BlockReason, string> = {
  forbidden: "You no longer have edit access",
  gone: "This document is no longer shared with you",
};

export type AutosaveState = {
  editVersion: number; // bumped on every local edit
  savedVersion: number; // highest editVersion confirmed by the server
  inFlight: { seq: number; version: number } | null;
  seq: number; // last request sequence number handed out
  error: string | null; // set after a failed save, cleared when the next save starts
  blocked: BlockReason | null; // terminal: access was lost, never send again
};

export function initialState(): AutosaveState {
  return { editVersion: 0, savedVersion: 0, inFlight: null, seq: 0, error: null, blocked: null };
}

/** The user changed the document locally. */
export function recordEdit(s: AutosaveState): AutosaveState {
  return { ...s, editVersion: s.editVersion + 1 };
}

/** There are local edits the server has not confirmed. */
export function isDirty(s: AutosaveState): boolean {
  return s.editVersion > s.savedVersion;
}

/** Warn before leaving: unsaved edits or a request still in flight. */
export function hasUnsaved(s: AutosaveState): boolean {
  return isDirty(s) || s.inFlight !== null;
}

/** A save should start now: something to save, nothing in flight, and access not lost. */
export function shouldSend(s: AutosaveState): boolean {
  return isDirty(s) && s.inFlight === null && s.blocked === null;
}

/** Marks a request as started; the caller sends the editor's latest HTML and keeps `seq`. */
export function startSend(s: AutosaveState): { state: AutosaveState; seq: number } {
  const seq = s.seq + 1;
  return {
    seq,
    state: { ...s, seq, inFlight: { seq, version: s.editVersion }, error: null },
  };
}

/** Server confirmed request `seq`. Stale responses (seq mismatch) are ignored. */
export function sendSucceeded(s: AutosaveState, seq: number): AutosaveState {
  if (!s.inFlight || s.inFlight.seq !== seq) return s;
  return {
    ...s,
    savedVersion: Math.max(s.savedVersion, s.inFlight.version),
    inFlight: null,
    error: null,
  };
}

/** Request `seq` failed. Stale responses are ignored. Edits stay dirty so a retry can resend them. */
export function sendFailed(s: AutosaveState, seq: number, message: string): AutosaveState {
  if (!s.inFlight || s.inFlight.seq !== seq) return s;
  return { ...s, inFlight: null, error: message };
}

/** Request `seq` was rejected because access was lost (403 or 404). Terminal; stale responses ignored. */
export function sendBlocked(s: AutosaveState, seq: number, reason: BlockReason): AutosaveState {
  if (!s.inFlight || s.inFlight.seq !== seq) return s;
  return { ...s, inFlight: null, error: null, blocked: reason };
}

/** What the single indicator shows. `idle` means show nothing (never edited yet). */
export function displayStatus(s: AutosaveState): SaveStatus {
  if (s.blocked) return "blocked";
  if (s.error && s.inFlight === null) return "error";
  if (s.inFlight || isDirty(s)) return "saving";
  return s.savedVersion > 0 ? "saved" : "idle";
}
