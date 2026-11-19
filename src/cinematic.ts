// Shared mutable values avoid React rerenders for every scroll/frame update.
export type SceneMode = "hero" | "take" | "globe" | "cabin" | "final";
export const chapterProgress: Record<SceneMode, { value: number }> = {
  hero: { value: 0 },
  take: { value: 0 },
  globe: { value: 0 },
  cabin: { value: 0 },
  final: { value: 0 },
};
export const AIRCRAFT_URL =
  "/models/aere-aircraft.glb?v=windshield-reference-4";
export const EARTH_URL = "/textures/earth.jpg";
export const CLOUD_URL = "/textures/cloud.png";
