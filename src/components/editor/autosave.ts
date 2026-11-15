// Pure autosave state machine (no React, no fetch). The hook drives it; tests exercise it directly.
//
// Rules:
// - At most one save request is in flight at a time, so responses cannot arrive out of order.
// - Every local edit bumps `editVersion`. A save remembers the request `seq` it was started with.
// - A response only counts if its `seq` matches the current in-flight request (stale ones are ignored).
// - "Saved" is shown only when the server confirmed a request and no newer edits exist.

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AutosaveState = {
  editVersion: number; // bumped on every local edit
  savedVersion: number; // highest editVersion confirmed by the server
  inFlight: { seq: number; version: number } | null;
  seq: number; // last request sequence number handed out
  error: string | null; // set after a failed save, cleared when the next save starts
};

export function initialState(): AutosaveState {
  return { editVersion: 0, savedVersion: 0, inFlight: null, seq: 0, error: null };
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

/** A save should start now: there is something to save and nothing is already in flight. */
export function shouldSend(s: AutosaveState): boolean {
  return isDirty(s) && s.inFlight === null;
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

/** What the single indicator shows. `idle` means show nothing (never edited yet). */
export function displayStatus(s: AutosaveState): SaveStatus {
  if (s.error && s.inFlight === null) return "error";
  if (s.inFlight || isDirty(s)) return "saving";
  return s.savedVersion > 0 ? "saved" : "idle";
}
