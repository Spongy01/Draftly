import { describe, expect, it } from "vitest";
import {
  displayStatus,
  hasUnsaved,
  initialState,
  isDirty,
  recordEdit,
  sendFailed,
  sendSucceeded,
  shouldSend,
  startSend,
  type AutosaveState,
} from "../src/components/editor/autosave";

function begin(s: AutosaveState) {
  return startSend(s);
}

describe("autosave state machine", () => {
  it("starts idle: nothing to save, nothing to warn about", () => {
    const s = initialState();
    expect(displayStatus(s)).toBe("idle");
    expect(isDirty(s)).toBe(false);
    expect(shouldSend(s)).toBe(false);
    expect(hasUnsaved(s)).toBe(false);
  });

  it("edit -> send -> success ends as saved and clean", () => {
    let s = recordEdit(initialState());
    expect(displayStatus(s)).toBe("saving"); // dirty, not yet sent
    expect(shouldSend(s)).toBe(true);
    expect(hasUnsaved(s)).toBe(true);

    const b = begin(s);
    s = b.state;
    expect(displayStatus(s)).toBe("saving");
    expect(shouldSend(s)).toBe(false); // one at a time

    s = sendSucceeded(s, b.seq);
    expect(displayStatus(s)).toBe("saved");
    expect(isDirty(s)).toBe(false);
    expect(hasUnsaved(s)).toBe(false);
  });

  it("does not report Saved before the server confirms", () => {
    let s = recordEdit(initialState());
    s = begin(s).state;
    expect(displayStatus(s)).not.toBe("saved");
  });

  it("edit during an in-flight save: response does not mark saved, a follow-up is needed", () => {
    let s = recordEdit(initialState()); // v1
    const first = begin(s);
    s = first.state;

    s = recordEdit(s); // v2 typed while v1 is in flight
    expect(shouldSend(s)).toBe(false); // still in flight

    s = sendSucceeded(s, first.seq); // v1 confirmed
    expect(displayStatus(s)).toBe("saving"); // newer edit unsaved
    expect(isDirty(s)).toBe(true);
    expect(hasUnsaved(s)).toBe(true);
    expect(shouldSend(s)).toBe(true); // follow-up now allowed

    const second = begin(s);
    s = sendSucceeded(second.state, second.seq);
    expect(displayStatus(s)).toBe("saved");
    expect(hasUnsaved(s)).toBe(false);
  });

  it("many edits during one in-flight save collapse into a single follow-up", () => {
    let s = recordEdit(initialState());
    const first = begin(s);
    s = first.state;
    for (let i = 0; i < 10; i++) s = recordEdit(s);
    s = sendSucceeded(s, first.seq);
    const second = begin(s);
    expect(second.state.inFlight?.version).toBe(11);
    s = sendSucceeded(second.state, second.seq);
    expect(isDirty(s)).toBe(false);
  });

  it("failed save shows error and keeps changes dirty", () => {
    let s = recordEdit(initialState());
    const b = begin(s);
    s = sendFailed(b.state, b.seq, "Network error");
    expect(displayStatus(s)).toBe("error");
    expect(s.error).toBe("Network error");
    expect(isDirty(s)).toBe(true);
    expect(hasUnsaved(s)).toBe(true);
    expect(shouldSend(s)).toBe(true); // retry is allowed
  });

  it("failed save then retry succeeds", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendFailed(a.state, a.seq, "boom");

    const retry = begin(s);
    expect(displayStatus(retry.state)).toBe("saving"); // error cleared when retry starts
    expect(retry.state.error).toBeNull();

    s = sendSucceeded(retry.state, retry.seq);
    expect(displayStatus(s)).toBe("saved");
    expect(hasUnsaved(s)).toBe(false);
  });

  it("failed save then retry fails again returns to error", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendFailed(a.state, a.seq, "first");
    const b = begin(s);
    s = sendFailed(b.state, b.seq, "second");
    expect(displayStatus(s)).toBe("error");
    expect(s.error).toBe("second");
  });

  it("typing while in the error state keeps showing error until the next save starts", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendFailed(a.state, a.seq, "boom");
    s = recordEdit(s);
    expect(displayStatus(s)).toBe("error");
    expect(shouldSend(s)).toBe(true);
    const b = begin(s);
    expect(displayStatus(b.state)).toBe("saving");
    expect(b.state.inFlight?.version).toBe(2); // the retry carries the newest edit
  });

  it("ignores a stale success from an older request", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendFailed(a.state, a.seq, "boom"); // request 1 failed
    const b = begin(s); // request 2 in flight
    const before = b.state;

    const afterStale = sendSucceeded(before, a.seq); // late success from request 1
    expect(afterStale).toBe(before); // untouched
    expect(afterStale.inFlight?.seq).toBe(b.seq);
    expect(isDirty(afterStale)).toBe(true);
    expect(displayStatus(afterStale)).toBe("saving");
  });

  it("ignores a stale failure from an older request", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendFailed(a.state, a.seq, "boom");
    const b = begin(s);
    const afterStale = sendFailed(b.state, a.seq, "late failure");
    expect(afterStale).toBe(b.state);
    expect(afterStale.error).toBeNull();
  });

  it("ignores a response when nothing is in flight", () => {
    const s = recordEdit(initialState());
    expect(sendSucceeded(s, 1)).toBe(s);
    expect(sendFailed(s, 1, "x")).toBe(s);
  });

  it("a response never lowers savedVersion", () => {
    let s = recordEdit(recordEdit(initialState())); // v2
    const a = begin(s);
    s = sendSucceeded(a.state, a.seq);
    expect(s.savedVersion).toBe(2);
    const e = recordEdit(s);
    const b = begin(e);
    expect(sendSucceeded(b.state, b.seq).savedVersion).toBe(3);
  });

  it("shouldSend is false when clean, even after a save", () => {
    let s = recordEdit(initialState());
    const a = begin(s);
    s = sendSucceeded(a.state, a.seq);
    expect(shouldSend(s)).toBe(false);
  });
});
