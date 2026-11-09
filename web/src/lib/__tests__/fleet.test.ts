import { describe, expect, it } from "vitest";
import type { Route } from "@/types/route";
import { fleetState, tripVisits, upcomingAtStop } from "@/lib/fleet";
import { busStatusText, clockOf, routeTitle } from "@/lib/describe";
import { cityClock } from "@/lib/time";
import { positionToPose } from "@/lib/path";
import { routeForDay } from "@/lib/service";

/** Bitta avtobus: qishloq → shahar, kutadi, shahar → qishloq. */
const route: Route = {
  route_id: "T",
  route_name: 'T-sonli "Shahar - Qishloq"',
  stops: [
    { name: "Qishloq", lat: 39.7, lng: 66.86 },
    { name: "O'rta", lat: 39.68, lng: 66.86 },
    { name: "Shahar", lat: 39.66, lng: 66.86 },
  ],
  trips: [
    { bus_id: "01S", bus: 1, times: ["08:00", "08:30", "09:00"] },
    { bus_id: "01Q", bus: 1, times: ["10:00", "09:45", "09:30"] },
    { bus_id: "02S", bus: 2, times: ["09:00", "09:30", "10:00"] },
  ],
};

const at = (h: number, m: number, s = 0): Date => new Date(2026, 8, 5, h, m, s);

describe("fleetState", () => {
  it("ertalab avtobus birinchi reys boshida kutadi", () => {
    const [bus1] = fleetState(route, at(7, 0));
    expect(bus1).toMatchObject({ bus: "1", status: "waiting", position: 0, direction: "shaharga", departsAt: 480 });
  });

  it("reys davomida harakatda, soniyalar ham hisobga olinadi", () => {
    const bus1 = fleetState(route, at(8, 15, 30)).find((b) => b.bus === "1")!;
    expect(bus1.status).toBe("moving");
    expect(bus1.position).toBeCloseTo(15.5 / 30, 5);
  });

  it("reyslar orasida oxirgi bekatda kutadi va keyingi yo'nalishga qaraydi", () => {
    const bus1 = fleetState(route, at(9, 10)).find((b) => b.bus === "1")!;
    expect(bus1).toMatchObject({ status: "waiting", position: 2, direction: "qishloqqa", departsAt: 570 });
  });

  it("qaytishda pozitsiya kamayadi", () => {
    const bus1 = fleetState(route, at(9, 52, 30)).find((b) => b.bus === "1")!;
    expect(bus1.status).toBe("moving");
    expect(bus1.position).toBeCloseTo(0.5, 5);
  });

  it("kun oxirida — finished", () => {
    const bus1 = fleetState(route, at(22, 0)).find((b) => b.bus === "1")!;
    expect(bus1).toMatchObject({ status: "finished", position: 0, departsAt: null });
  });

  it("har bir avtobus bitta holat", () => {
    expect(fleetState(route, at(9, 15)).map((b) => b.bus)).toEqual(["1", "2"]);
  });
});

describe("tripVisits", () => {
  it("qishloqqa reysi harakat tartibida", () => {
    expect(tripVisits(route.trips[1]!).map((v) => v.index)).toEqual([2, 1, 0]);
  });
});

describe("upcomingAtStop", () => {
  it("tartiblangan, o'tganlari tashlangan, oxirgi bekatga kelish belgilangan", () => {
    const list = upcomingAtStop(route, 2, at(9, 20));
    expect(list.map((v) => [v.trip.bus_id, v.minute, v.isArrival])).toEqual([
      ["01Q", 570, false],
      ["02S", 600, true],
    ]);
  });
});

describe("matnlar", () => {
  it("routeTitle", () => expect(routeTitle(route)).toBe("Shahar — Qishloq"));
  it("clockOf", () => expect(clockOf(1445)).toBe("00:05"));
  it("kutayotgan avtobus holati", () => {
    const state = fleetState(route, at(9, 10)).find((b) => b.bus === "1")!;
    expect(busStatusText(route, state, at(9, 10))).toBe("Shaharda turibdi · 09:30 da jo'naydi");
  });
});

describe("cityClock", () => {
  it("qurilma mintaqasidan qat'i nazar shahar vaqtini beradi", () => {
    const utc = Date.UTC(2026, 10, 9, 10, 0); // 10:00 UTC = 15:00 Toshkent
    const clock = cityClock(5, utc);
    expect(clock.getHours()).toBe(15);
    expect(clock.getMinutes()).toBe(0);
  });
});

describe("positionToPose", () => {
  it("janubga (shaharga) harakatda azimut ~180°", () => {
    const pose = positionToPose(route, 0.5, true)!;
    expect(pose.heading).toBeCloseTo(180, 0);
  });
  it("teskari yo'nalishda ~0°, chiziq chetida ham", () => {
    expect(positionToPose(route, 2, false)!.heading).toBeCloseTo(0, 0);
    expect(positionToPose(route, 2, true)!.heading).toBeCloseTo(180, 0);
  });
});

describe("routeForDay", () => {
  const multi: Route = {
    ...route,
    trips: [
      { bus_id: "01S", bus: 1, service: "weekday", times: ["08:00", "08:30", "09:00"] },
      { bus_id: "S01S", bus: 1, service: "sunday", times: ["09:00", "09:30", "10:00"] },
    ],
    timetables: [
      { id: "weekday", days: [0, 1, 2, 3, 4, 5], columns: [], rows: [] },
      { id: "sunday", days: [6], columns: [], rows: [] },
    ],
    holidays: ["2027-01-01"],
  };
  const ids = (d: Date) => routeForDay(multi, d).trips.map((t) => t.bus_id);
  it("ish kuni, yakshanba va bayram", () => {
    expect(ids(new Date(2026, 10, 9))).toEqual(["01S"]);
    expect(ids(new Date(2026, 10, 8))).toEqual(["S01S"]);
    expect(ids(new Date(2027, 0, 1))).toEqual(["S01S"]);
  });
});
