import { describe, expect, it } from "vitest";
import { matchWaitlistForCancelledSlot } from "@/lib/appointments/waitlist";

describe("matchWaitlistForCancelledSlot", () => {
  const base = {
    service_id: null as string | null,
    location_id: null as string | null,
    preferred_from: null as string | null,
    preferred_to: null as string | null,
    status: "waiting",
    priority: 0,
    created_at: "2026-07-01T10:00:00.000Z",
  };

  it("matches FIFO by priority then created_at", () => {
    const rows = [
      {
        ...base,
        id: "a",
        patient_id: "p1",
        doctor_id: "d1",
        priority: 0,
        created_at: "2026-07-02T10:00:00.000Z",
      },
      {
        ...base,
        id: "b",
        patient_id: "p2",
        doctor_id: "d1",
        priority: 1,
        created_at: "2026-07-03T10:00:00.000Z",
      },
      {
        ...base,
        id: "c",
        patient_id: "p3",
        doctor_id: "d1",
        priority: 0,
        created_at: "2026-07-01T10:00:00.000Z",
      },
    ];

    const matched = matchWaitlistForCancelledSlot(rows, {
      doctorId: "d1",
      serviceId: null,
      locationId: null,
      startsAt: new Date("2026-07-13T10:00:00.000Z"),
    });

    expect(matched.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by doctor and preferred window", () => {
    const rows = [
      {
        ...base,
        id: "ok",
        patient_id: "p1",
        doctor_id: "d1",
        preferred_from: "2026-07-10",
        preferred_to: "2026-07-20",
      },
      {
        ...base,
        id: "wrong-doc",
        patient_id: "p2",
        doctor_id: "d2",
      },
      {
        ...base,
        id: "out-of-window",
        patient_id: "p3",
        doctor_id: null,
        preferred_from: "2026-08-01",
        preferred_to: "2026-08-10",
      },
    ];

    const matched = matchWaitlistForCancelledSlot(rows, {
      doctorId: "d1",
      serviceId: null,
      locationId: null,
      startsAt: new Date("2026-07-13T10:00:00.000Z"),
    });

    expect(matched.map((r) => r.id)).toEqual(["ok"]);
  });
});
