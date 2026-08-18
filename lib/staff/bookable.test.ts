import { describe, expect, it } from "vitest";
import {
  countDoctorSeats,
  isBookableDoctor,
  toDoctorOptions,
} from "@/lib/staff/bookable";

describe("isBookableDoctor (D56)", () => {
  it("treats hired doctors as bookable", () => {
    expect(isBookableDoctor({ role: "doctor" })).toBe(true);
    expect(
      isBookableDoctor({ role: "doctor", practices_as_doctor: false }),
    ).toBe(true);
  });

  it("treats owner as bookable only when practices_as_doctor is on", () => {
    expect(isBookableDoctor({ role: "owner" })).toBe(false);
    expect(
      isBookableDoctor({ role: "owner", practices_as_doctor: false }),
    ).toBe(false);
    expect(
      isBookableDoctor({ role: "owner", practices_as_doctor: true }),
    ).toBe(true);
  });

  it("never treats other roles as bookable", () => {
    expect(
      isBookableDoctor({ role: "reception", practices_as_doctor: true }),
    ).toBe(false);
    expect(isBookableDoctor({ role: "assistant" })).toBe(false);
    expect(isBookableDoctor({ role: "accountant" })).toBe(false);
  });
});

describe("countDoctorSeats (D56)", () => {
  it("counts practicing owner plus hired doctors and pending doctor invites", () => {
    expect(
      countDoctorSeats(
        [
          { role: "owner", practices_as_doctor: true },
          { role: "doctor" },
          { role: "reception" },
        ],
        [{ role: "doctor" }, { role: "reception" }],
      ),
    ).toBe(3);
  });

  it("does not count owner without the flag", () => {
    expect(
      countDoctorSeats([{ role: "owner", practices_as_doctor: false }], []),
    ).toBe(0);
  });
});

describe("toDoctorOptions", () => {
  it("keeps practicing owner and doctors", () => {
    expect(
      toDoctorOptions([
        {
          id: "o",
          full_name: "Ana Owner",
          role: "owner",
          practices_as_doctor: true,
        },
        { id: "d", full_name: "Dr Dragan", role: "doctor" },
        { id: "r", full_name: "Rina", role: "reception" },
      ]),
    ).toEqual([
      { id: "o", fullName: "Ana Owner" },
      { id: "d", fullName: "Dr Dragan" },
    ]);
  });
});
