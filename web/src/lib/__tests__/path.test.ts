import { describe, expect, it } from "vitest";
import type { Route } from "@/types/route";
import { interpolateAlongPath, legPoints, positionToPoint, routePolyline } from "@/lib/path";

const baseRoute: Route = {
  route_id: "T",
  route_name: "Test",
  stops: [
    { name: "A", lat: 39.7, lng: 66.86 },
    { name: "B", lat: 39.68, lng: 66.86 },
    { name: "C", lat: 39.66, lng: 66.86 },
  ],
  trips: [{ bus_id: "UP", times: ["08:00", "08:30", "09:00"] }],
};

/** A dan B gacha yo'l g'arbga chiqib, keyin qaytadi (to'g'ri chiziq emas). */
const withGeometry: Route = {
  ...baseRoute,
  geometry: {
    legs: [
      [
        [39.7, 66.86],
        [39.69, 66.84],
        [39.68, 66.86],
      ],
      [
        [39.68, 66.86],
        [39.66, 66.86],
      ],
    ],
  },
};

describe("legPoints", () => {
  it("geometriya bo'lmasa to'g'ri chiziq beradi", () => {
    expect(legPoints(baseRoute, 0)).toEqual([
      { lat: 39.7, lng: 66.86 },
      { lat: 39.68, lng: 66.86 },
    ]);
  });

  it("geometriya bo'lsa uni ishlatadi", () => {
    expect(legPoints(withGeometry, 0)).toHaveLength(3);
    expect(legPoints(withGeometry, 0)[1]).toEqual({ lat: 39.69, lng: 66.84 });
  });

  it("chegaradan tashqarida bo'sh", () => {
    expect(legPoints(baseRoute, 5)).toEqual([]);
  });

  it("bir nuqtali oraliqni e'tiborsiz qoldirib to'g'ri chiziqqa qaytadi", () => {
    const broken: Route = { ...baseRoute, geometry: { legs: [[[39.7, 66.86]], []] } };
    expect(legPoints(broken, 0)).toHaveLength(2);
  });
});

describe("routePolyline", () => {
  it("oraliqlarni tutashtiradi, tugunni takrorlamaydi", () => {
    // 3 nuqta + (2 nuqta − 1 takror) = 4
    expect(routePolyline(withGeometry)).toHaveLength(4);
  });

  it("geometriyasiz bekatlar ro'yxatini beradi", () => {
    expect(routePolyline(baseRoute)).toHaveLength(3);
  });
});

describe("interpolateAlongPath", () => {
  const line = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
  ];

  it("yarmida o'rtani beradi", () => {
    const point = interpolateAlongPath(line, 0.5)!;
    expect(point.lng).toBeCloseTo(0.5, 5);
  });

  it("chetlarni qaytaradi", () => {
    expect(interpolateAlongPath(line, 0)).toEqual({ lat: 0, lng: 0 });
    expect(interpolateAlongPath(line, 1)!.lng).toBeCloseTo(1, 5);
  });

  it("chegaradan tashqaridagi qiymatni qisadi", () => {
    expect(interpolateAlongPath(line, -5)).toEqual({ lat: 0, lng: 0 });
    expect(interpolateAlongPath(line, 9)!.lng).toBeCloseTo(1, 5);
  });

  it("bo'sh ro'yxat uchun null", () => {
    expect(interpolateAlongPath([], 0.5)).toBeNull();
  });

  it("taqsimot masofa bo'yicha, nuqtalar soni bo'yicha emas", () => {
    // Birinchi bo'lak 10 barobar uzun; yarmida hali birinchi bo'lakda bo'lishi kerak.
    const uneven = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 0, lng: 11 },
    ];
    const point = interpolateAlongPath(uneven, 0.5)!;
    expect(point.lng).toBeGreaterThan(5.4);
    expect(point.lng).toBeLessThan(5.6);
  });
});

describe("positionToPoint", () => {
  it("bekat ustidagi butun pozitsiya bekatning o'zini beradi", () => {
    const point = positionToPoint(baseRoute, 1)!;
    expect(point.lat).toBeCloseTo(39.68, 6);
  });

  it("oraliqning yarmi to'g'ri chiziqda o'rtani beradi", () => {
    const point = positionToPoint(baseRoute, 0.5)!;
    expect(point.lat).toBeCloseTo(39.69, 4);
  });

  it("geometriya bo'lsa yo'ldan chetga chiqadi", () => {
    // A->B yo'li g'arbga (66.84) chiqadi, to'g'ri chiziq esa 66.86 da qolardi.
    const point = positionToPoint(withGeometry, 0.5)!;
    expect(point.lng).toBeLessThan(66.855);
  });

  it("oxirgi bekatdan keyin ham chegarada qoladi", () => {
    const point = positionToPoint(baseRoute, 99)!;
    expect(point.lat).toBeCloseTo(39.66, 6);
  });

  it("manfiy pozitsiya birinchi bekatga qisiladi", () => {
    expect(positionToPoint(baseRoute, -3)!.lat).toBeCloseTo(39.7, 6);
  });
});
