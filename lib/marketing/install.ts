export const INSTALL_PLATFORMS = [
  "android",
  "ios",
  "windows",
  "mac",
] as const;

export type InstallPlatform = (typeof INSTALL_PLATFORMS)[number];

/** Number of numbered steps per platform (matches message keys step1…). */
export const INSTALL_STEP_COUNTS: Record<InstallPlatform, number> = {
  android: 4,
  ios: 4,
  windows: 3,
  mac: 3,
};
