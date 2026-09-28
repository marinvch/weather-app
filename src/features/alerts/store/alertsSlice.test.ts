import { describe, it, expect } from "vitest";
import reducer, {
  addAlert,
  clearAlerts,
  markAlertAsRead,
  markAlertAsUnread,
  markAllAlertsAsRead,
  removeAlert,
  restoreDismissedAlerts,
  setAlerts,
} from "./alertsSlice";
import type { WeatherAlert } from "@/shared/types/weather";

function alert(id: string, fields: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id,
    type: "warning",
    profile: "general",
    title: `Alert ${id}`,
    message: "Something is happening",
    timestamp: "2026-09-05T09:00:00.000Z",
    conditions: {},
    ...fields,
  };
}

const empty = reducer(undefined, { type: "@@INIT" });

describe("alertsSlice — read state", () => {
  it("actually marks an alert read", () => {
    // This reducer used to find the alert and then execute an empty `if` body
    // with a comment where the work belonged, so nothing was ever read. The
    // test exists to keep it doing something.
    const state = reducer(
      reducer(empty, addAlert(alert("wind-gale-2026-09-05"))),
      markAlertAsRead("wind-gale-2026-09-05"),
    );

    expect(state.readIds).toEqual(["wind-gale-2026-09-05"]);
  });

  it("does not record the same id twice", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, markAlertAsRead("a"));
    state = reducer(state, markAlertAsRead("a"));

    expect(state.readIds).toEqual(["a"]);
  });

  it("marks every active alert read at once", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, addAlert(alert("b")));
    state = reducer(state, markAllAlertsAsRead());

    expect([...state.readIds].sort()).toEqual(["a", "b"]);
  });

  it("can put one back to unread", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, markAlertAsRead("a"));
    state = reducer(state, markAlertAsUnread("a"));

    expect(state.readIds).toEqual([]);
  });

  it("keeps read state when the same alert is re-derived", () => {
    // The derivation is a pure function of the forecast, so a refetch re-emits
    // an identical alert. Tracking read state by id rather than on the alert
    // object is what stops that from silently marking it unread again.
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, markAlertAsRead("a"));
    state = reducer(state, addAlert(alert("a", { message: "updated" })));

    expect(state.readIds).toEqual(["a"]);
    expect(state.alerts[0].message).toBe("updated");
  });
});

describe("alertsSlice — dismissal", () => {
  it("makes a dismissal stick against a re-derive", () => {
    // Without this, dismissing anything is a button that clears the alert for
    // one render and then puts it straight back on the next refetch.
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, removeAlert("a"));

    expect(state.alerts).toEqual([]);

    state = reducer(state, addAlert(alert("a")));
    expect(state.alerts).toEqual([]);
    expect(state.dismissedIds).toEqual(["a"]);
  });

  it("dismisses everything on clear, not just this render", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, addAlert(alert("b")));
    state = reducer(state, clearAlerts());

    expect(state.alerts).toEqual([]);
    expect([...state.dismissedIds].sort()).toEqual(["a", "b"]);

    state = reducer(state, setAlerts([alert("a"), alert("b")]));
    expect(state.alerts).toEqual([]);
  });

  it("lets dismissals be undone", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, removeAlert("a"));
    state = reducer(state, restoreDismissedAlerts());
    state = reducer(state, addAlert(alert("a")));

    expect(state.alerts.map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("alertsSlice — setAlerts", () => {
  it("drops breaches that have passed", () => {
    // `addAlert` alone can only ever grow the list, so an alert whose weather
    // has moved on stays on screen forever. Replacing the set is what lets one
    // disappear.
    let state = reducer(empty, setAlerts([alert("a"), alert("b")]));
    state = reducer(state, setAlerts([alert("b")]));

    expect(state.alerts.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("still records everything it saw in history", () => {
    let state = reducer(empty, setAlerts([alert("a")]));
    state = reducer(state, setAlerts([alert("b")]));

    expect(state.history.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
  });

  it("honours dismissals", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, removeAlert("a"));
    state = reducer(state, setAlerts([alert("a"), alert("b")]));

    expect(state.alerts.map((entry) => entry.id)).toEqual(["b"]);
  });
});

describe("alertsSlice — history", () => {
  it("records an alert once, newest first", () => {
    let state = reducer(empty, addAlert(alert("a")));
    state = reducer(state, addAlert(alert("b")));
    state = reducer(state, addAlert(alert("a")));

    expect(state.history.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("keeps at most fifty entries", () => {
    let state = empty;
    for (let i = 0; i < 60; i += 1) {
      state = reducer(state, addAlert(alert(`alert-${i}`)));
    }

    expect(state.history).toHaveLength(50);
    expect(state.history[0].id).toBe("alert-59");
  });
});
