import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, minutesOfDay, parseTime } from "@/lib/time";

describe("parseTime", () => {
  it.each([
    ["00:00", 0],
    ["06:12", 372],
    ["23:59", 1439],
  ])("%s -> %i", (value, expected) => {
    expect(parseTime(value as string)).toBe(expected);
  });

  it.each(["24:00", "12:60", "abc", "6:1", ""])("%s xato beradi", (value) => {
    expect(() => parseTime(value)).toThrow();
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "hozir"],
    [-5, "hozir"],
    [25, "25 daqiqa"],
    [60, "1 soat"],
    [75, "1 soat 15 daqiqa"],
    [180, "3 soat"],
  ])("%i -> %s", (minutes, expected) => {
    expect(formatDuration(minutes as number)).toBe(expected);
  });
});

describe("minutesOfDay va formatClock", () => {
  it("daqiqaga aylantiradi", () => {
    expect(minutesOfDay(new Date(2026, 8, 5, 10, 30))).toBe(630);
  });

  it("nol bilan to'ldiradi", () => {
    expect(formatClock(new Date(2026, 8, 5, 9, 5))).toBe("09:05");
  });
});
