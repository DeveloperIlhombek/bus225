import { describe, expect, it } from "vitest";
import type { Route } from "@/types/route";
import {
  activeBuses,
  departuresAt,
  markMeetings,
  nextDeparturesAt,
  oppositeOf,
  tripDirection,
  tripPosition,
} from "@/lib/schedule";

const toyRoute: Route = {
  route_id: "T",
  route_name: "Test yo'nalishi",
  stops: [
    { name: "Qishloq", lat: 39.7, lng: 66.86 },
    { name: "Orta", lat: 39.68, lng: 66.84 },
    { name: "Shahar", lat: 39.66, lng: 66.98 },
  ],
  trips: [
    { bus_id: "UP", times: ["08:00", "08:30", "09:00"] },
    { bus_id: "DOWN", times: ["09:00", "08:30", "08:00"] },
    { bus_id: "SKIP", times: ["10:00", null, "11:00"] },
  ],
};

const at = (hours: number, minutes: number): Date => new Date(2026, 8, 5, hours, minutes);

describe("tripDirection", () => {
  it("vaqt oshsa shaharga", () => {
    expect(tripDirection(toyRoute.trips[0]!)).toBe("shaharga");
  });

  it("vaqt kamaysa qishloqqa", () => {
    expect(tripDirection(toyRoute.trips[1]!)).toBe("qishloqqa");
  });

  it("null qiymatlar hisobga olinmaydi", () => {
    expect(tripDirection(toyRoute.trips[2]!)).toBe("shaharga");
  });

  it("ikkitadan kam vaqt bolsa null", () => {
    expect(tripDirection({ bus_id: "X", times: ["08:00", null, null] })).toBeNull();
  });

  it("oppositeOf teskarisini beradi", () => {
    expect(oppositeOf("shaharga")).toBe("qishloqqa");
    expect(oppositeOf("qishloqqa")).toBe("shaharga");
  });
});

describe("tripPosition", () => {
  it("birinchi oraliqning ortasi", () => {
    expect(tripPosition(toyRoute.trips[0]!, at(8, 15))).toBeCloseTo(0.5);
  });

  it("ikkinchi oraliq", () => {
    expect(tripPosition(toyRoute.trips[0]!, at(8, 45))).toBeCloseTo(1.5);
  });

  it("teskari reys uchun ham bir xil formula", () => {
    expect(tripPosition(toyRoute.trips[1]!, at(8, 45))).toBeCloseTo(0.5);
  });

  it("boshlanishdan oldin null", () => {
    expect(tripPosition(toyRoute.trips[0]!, at(7, 0))).toBeNull();
  });

  it("tugagandan keyin null", () => {
    expect(tripPosition(toyRoute.trips[0]!, at(22, 0))).toBeNull();
  });
});

describe("departuresAt", () => {
  it("yonalish boyicha ajratadi", () => {
    expect(departuresAt(toyRoute, 0)).toEqual({
      shaharga: ["08:00", "10:00"],
      qishloqqa: ["09:00"],
    });
  });

  it("null bekatni tashlab ketadi", () => {
    expect(departuresAt(toyRoute, 1).shaharga).toEqual(["08:30"]);
  });

  it("chegaradan tashqarida bosh natija", () => {
    expect(departuresAt(toyRoute, 99)).toEqual({ shaharga: [], qishloqqa: [] });
  });
});

describe("nextDeparturesAt", () => {
  it("otgan vaqtlarni filtrlaydi", () => {
    const result = nextDeparturesAt(toyRoute, 0, at(8, 30), 5);
    expect(result.shaharga.map((d) => d.time)).toEqual(["10:00"]);
    expect(result.qishloqqa.map((d) => d.time)).toEqual(["09:00"]);
  });

  it("qolgan daqiqani hisoblaydi", () => {
    const [first] = nextDeparturesAt(toyRoute, 0, at(8, 30), 1).qishloqqa;
    expect(first?.minutesAway).toBe(30);
  });

  it("limitga boysunadi", () => {
    expect(nextDeparturesAt(toyRoute, 0, at(0, 0), 1).shaharga).toHaveLength(1);
  });

  it("kun tugaganda bosh", () => {
    expect(nextDeparturesAt(toyRoute, 0, at(23, 30), 3).shaharga).toEqual([]);
  });
});

describe("markMeetings", () => {
  it("qarama-qarshi va yaqin avtobuslar uchrashadi", () => {
    const result = markMeetings(
      [
        { busId: "A", direction: "shaharga", position: 2.0 },
        { busId: "B", direction: "qishloqqa", position: 2.05 },
      ],
      5,
    );
    expect(result.map((b) => b.meetingWith)).toEqual(["B", "A"]);
  });

  it("bir xil yonalishdagilar uchrashmaydi", () => {
    const result = markMeetings(
      [
        { busId: "A", direction: "shaharga", position: 2.0 },
        { busId: "B", direction: "shaharga", position: 2.0 },
      ],
      5,
    );
    expect(result.every((b) => b.meetingWith === null)).toBe(true);
  });

  it("uzoqdagilar uchrashmaydi", () => {
    const result = markMeetings(
      [
        { busId: "A", direction: "shaharga", position: 0.5 },
        { busId: "B", direction: "qishloqqa", position: 3.5 },
      ],
      5,
    );
    expect(result.every((b) => b.meetingWith === null)).toBe(true);
  });
});

describe("activeBuses", () => {
  it("faqat harakatdagilarni qaytaradi", () => {
    const buses = activeBuses(toyRoute, at(8, 15));
    expect(buses.map((b) => b.busId).sort()).toEqual(["DOWN", "UP"]);
  });

  it("tunda bosh", () => {
    expect(activeBuses(toyRoute, at(3, 0))).toEqual([]);
  });

  it("pozitsiyalar chegara ichida", () => {
    for (const bus of activeBuses(toyRoute, at(8, 15))) {
      expect(bus.position).toBeGreaterThanOrEqual(0);
      expect(bus.position).toBeLessThanOrEqual(toyRoute.stops.length - 1);
    }
  });
});
