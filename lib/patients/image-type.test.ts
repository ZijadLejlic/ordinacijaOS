import { describe, expect, it } from "vitest";
import {
  canAttemptPatientImageDecode,
  isAllowedPatientImageFile,
  isHeicLikeFile,
} from "@/lib/patients/image-type";

describe("isAllowedPatientImageFile", () => {
  it("allows jpeg/png/webp/heic", () => {
    expect(
      isAllowedPatientImageFile({ type: "image/jpeg", name: "a.jpg" }),
    ).toBe(true);
    expect(
      isAllowedPatientImageFile({ type: "image/png", name: "a.png" }),
    ).toBe(true);
    expect(
      isAllowedPatientImageFile({ type: "image/webp", name: "a.webp" }),
    ).toBe(true);
    expect(
      isAllowedPatientImageFile({ type: "image/heic", name: "IMG_1.HEIC" }),
    ).toBe(true);
  });

  it("allows iOS empty MIME with camera-roll extension", () => {
    expect(isAllowedPatientImageFile({ type: "", name: "IMG_1234.HEIC" })).toBe(
      true,
    );
    expect(isAllowedPatientImageFile({ type: "  ", name: "scan.tiff" })).toBe(
      true,
    );
  });

  it("allows Android octet-stream / x-png gallery quirks", () => {
    expect(
      isAllowedPatientImageFile({
        type: "application/octet-stream",
        name: "1000001234.jpg",
      }),
    ).toBe(true);
    expect(
      isAllowedPatientImageFile({ type: "image/x-png", name: "Screenshot.png" }),
    ).toBe(true);
  });

  it("rejects exe, svg, pdf, and empty junk", () => {
    expect(
      isAllowedPatientImageFile({
        type: "application/octet-stream",
        name: "payload.exe",
      }),
    ).toBe(false);
    expect(
      isAllowedPatientImageFile({ type: "image/svg+xml", name: "x.svg" }),
    ).toBe(false);
    expect(
      isAllowedPatientImageFile({ type: "application/pdf", name: "x.pdf" }),
    ).toBe(false);
    expect(isAllowedPatientImageFile({ type: "", name: "noext" })).toBe(false);
  });
});

describe("canAttemptPatientImageDecode", () => {
  it("lets Android unlabeled gallery files through to canvas", () => {
    expect(canAttemptPatientImageDecode({ type: "", name: "image" })).toBe(
      true,
    );
    expect(canAttemptPatientImageDecode({ type: "", name: "blob" })).toBe(true);
    expect(
      canAttemptPatientImageDecode({
        type: "application/octet-stream",
        name: "content",
      }),
    ).toBe(true);
  });

  it("still blocks pdf/video/svg before decode", () => {
    expect(
      canAttemptPatientImageDecode({ type: "application/pdf", name: "a.pdf" }),
    ).toBe(false);
    expect(
      canAttemptPatientImageDecode({ type: "video/mp4", name: "a.mp4" }),
    ).toBe(false);
    expect(
      canAttemptPatientImageDecode({ type: "image/svg+xml", name: "a.svg" }),
    ).toBe(false);
  });
});

describe("isHeicLikeFile", () => {
  it("detects heic/heif by mime or extension", () => {
    expect(isHeicLikeFile({ type: "image/heic", name: "a.jpg" })).toBe(true);
    expect(isHeicLikeFile({ type: "", name: "IMG.HEIF" })).toBe(true);
    expect(isHeicLikeFile({ type: "image/jpeg", name: "a.jpg" })).toBe(false);
  });
});
