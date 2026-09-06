import { describe, expect, it } from "vitest";
import type { Stop } from "@/types/route";
import { distanceMeters, findNearestStop, formatDistance } from "@/lib/geo";

const stops: Stop[] = [
  { name: "A", lat: 39.7, lng: 66.86 },
  { name: "B", lat: 39.68, lng: 66.84 },
  { name: "C", lat: 39.66, lng: 66.98 },
];

describe("distanceMeters", () => {
  it("bir xil nuqta uchun nol", () => {
    expect(distanceMeters(stops[0]!, stops[0]!)).toBe(0);
  });

  it("bir daraja kenglikning yuzdan biri taxminan 1.1 km", () => {
    const meters = distanceMeters({ lat: 39.7, lng: 66.86 }, { lat: 39.71, lng: 66.86 });
    expect(meters).toBeGreaterThan(1050);
    expect(meters).toBeLessThan(1160);
  });

  it("simmetrik", () => {
    expect(distanceMeters(stops[0]!, stops[2]!)).toBeCloseTo(
      distanceMeters(stops[2]!, stops[0]!),
      6,
    );
  });
});

describe("findNearestStop", () => {
  it("eng yaqinini topadi", () => {
    const nearest = findNearestStop(stops, { lat: 39.681, lng: 66.841 });
    expect(nearest?.index).toBe(1);
    expect(nearest?.stop.name).toBe("B");
  });

  it("joylashuv berilmasa null", () => {
    expect(findNearestStop(stops, null)).toBeNull();
  });

  it("bekatlar bo'sh bo'lsa null", () => {
    expect(findNearestStop([], { lat: 0, lng: 0 })).toBeNull();
  });
});

describe("formatDistance", () => {
  it.each([
    [250, "250 m"],
    [999, "999 m"],
    [1500, "1.5 km"],
  ])("%i -> %s", (meters, expected) => {
    expect(formatDistance(meters as number)).toBe(expected);
  });
});
