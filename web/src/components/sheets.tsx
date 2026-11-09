"use client";

import { useState } from "react";
import type { GeoPoint, Route } from "@/types/route";
import type { BusState } from "@/lib/fleet";
import { tripEnd, tripStart, tripVisits, upcomingAtStop } from "@/lib/fleet";
import { tripDirection } from "@/lib/schedule";
import { busStatusText, clockOf, currentSpeedKmh, routeTitle, terminalName } from "@/lib/describe";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { exactMinutesOfDay, formatShortDuration } from "@/lib/time";
import { BusNumber, Icon, Item, RouteBadge, SectionTitle, SheetHeader, StopIcon } from "@/components/ui";

export type View =
  | { readonly name: "home" }
  | { readonly name: "search" }
  | { readonly name: "stop"; readonly index: number }
  | { readonly name: "bus"; readonly id: string }
  | { readonly name: "timetable" };

interface SheetProps {
  readonly route: Route;
  readonly now: Date;
  readonly fleet: readonly BusState[];
  readonly open: (view: View) => void;
  readonly back: () => void;
  /** Hozir jonli joylashuv yuborayotgan avtobuslar. */
  readonly liveBuses: ReadonlySet<string>;
}

const routesLabel = (route: Route) => `Bekat · ${route.route_id}`;

// ------------------------------------------------------------------------- bosh sahifa
export function HomeSheet({
  route,
  now,
  fleet,
  open,
  reference,
  isUserLocation,
}: SheetProps & { reference: GeoPoint; isUserLocation: boolean }) {
  const nearest = route.stops
    .map((stop, index) => ({ stop, index, meters: distanceMeters(reference, stop) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 3);
  const moving = fleet.filter((bus) => bus.status === "moving").length;
  const current = exactMinutesOfDay(now);
  const nextStart = route.trips
    .filter((trip) => tripDirection(trip) === "shaharga")
    .map(tripStart)
    .filter((minute) => minute >= current)
    .sort((a, b) => a - b)[0];

  return (
    <>
      <button type="button" className="search" onClick={() => open({ name: "search" })}>
        {Icon.search}
        <span className="label">Qayerga?</span>
        {Icon.go}
      </button>
      <ul className="list">
        <Item
          icon={<RouteBadge id={route.route_id} />}
          title={routeTitle(route)}
          subtitle={
            `${moving} ta avtobus yo'lda` +
            (nextStart !== undefined ? ` · qishloqdan keyingisi ${clockOf(nextStart)}` : "")
          }
          onClick={() => open({ name: "timetable" })}
        />
        {nearest.map(({ stop, index, meters }) => (
          <Item
            key={stop.name}
            icon={Icon.pin}
            title={stop.name}
            subtitle={routesLabel(route)}
            end={isUserLocation ? formatDistance(meters) : undefined}
            onClick={() => open({ name: "stop", index })}
          />
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------------- qidiruv
export function SearchSheet({ route, open, back }: SheetProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const stops = route.stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => !q || stop.name.toLowerCase().includes(q));
  const showRoute = !q || route.route_id.includes(q) || routeTitle(route).toLowerCase().includes(q);

  return (
    <>
      <div className="search">
        {Icon.search}
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bekat nomi"
          autoComplete="off"
        />
        <button type="button" className="close" onClick={back} aria-label="Yopish">
          {Icon.close}
        </button>
      </div>
      <ul className="list">
        {showRoute ? (
          <Item
            icon={<RouteBadge id={route.route_id} />}
            title={routeTitle(route)}
            subtitle={`${route.stops.length} ta bekat · jadval`}
            onClick={() => open({ name: "timetable" })}
          />
        ) : null}
        {stops.map(({ stop, index }) => (
          <Item
            key={stop.name}
            icon={Icon.pin}
            title={stop.name}
            subtitle={routesLabel(route)}
            onClick={() => open({ name: "stop", index })}
          />
        ))}
        {!showRoute && stops.length === 0 ? <li className="empty">Hech narsa topilmadi</li> : null}
      </ul>
    </>
  );
}

// ------------------------------------------------------------------------- bekat
export function StopSheet({ route, now, open, back, liveBuses, index }: SheetProps & { index: number }) {
  const stop = route.stops[index];
  if (!stop) return null;
  const current = exactMinutesOfDay(now);
  const visits = upcomingAtStop(route, index, now, 30);
  const sections = (["shaharga", "qishloqqa"] as const).map((direction) => ({
    direction,
    items: visits.filter((visit) => visit.direction === direction).slice(0, 4),
  }));
  const firstTomorrow = (direction: "shaharga" | "qishloqqa") =>
    route.trips
      .filter((trip) => tripDirection(trip) === direction && trip.times[index] != null)
      .map((trip) => trip.times[index]!)
      .sort()[0];

  return (
    <>
      <SheetHeader icon={<StopIcon large />} title={stop.name} subtitle={routesLabel(route)} onClose={back} />
      {sections.map(({ direction, items }) => {
        // Oxirgi bekatda shu tomonga jo'nash bo'lmaydi
        const hasAny = route.trips.some((t) => tripDirection(t) === direction && t.times[index] != null);
        if (!hasAny) return null;
        const label = direction === "shaharga" ? "🏙 Shaharga" : "🏡 Qishloqqa";
        return (
          <div key={direction}>
            <SectionTitle>
              {label} · {terminalName(route, direction)}
            </SectionTitle>
            {items.length ? (
              <ul className="list">
                {items.map((visit) => {
                  const left = visit.minute - current;
                  return (
                    <Item
                      key={visit.trip.bus_id}
                      icon={<BusNumber value={visit.bus} />}
                      title={`${visit.bus}-avtobus${liveBuses.has(visit.bus) ? " · 📡" : ""}`}
                      subtitle={visit.isArrival ? "shu yerga keladi" : formatShortDuration(left) + (left >= 1 ? " qoldi" : "")}
                      end={clockOf(visit.minute)}
                      endSoon={left < 10}
                      onClick={() => open({ name: "bus", id: visit.bus })}
                    />
                  );
                })}
              </ul>
            ) : (
              <div className="empty">Bugungi reyslar tugadi · ertaga {firstTomorrow(direction) ?? "—"}</div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------------- avtobus
export function BusSheet({
  route,
  now,
  fleet,
  open,
  back,
  liveBuses,
  id,
  stopDistances,
}: SheetProps & { id: string; stopDistances: readonly number[] }) {
  const state = fleet.find((bus) => bus.bus === id);
  const trips = route.trips
    .filter((trip) => String(trip.bus ?? trip.bus_id) === id)
    .sort((a, b) => tripStart(a) - tripStart(b));
  if (!state) {
    return (
      <>
        <SheetHeader icon={<RouteBadge id={route.route_id} large />} title={`${id}-avtobus`} onClose={back} />
        <div className="empty">Ma&apos;lumot yo&apos;q</div>
      </>
    );
  }
  const current = exactMinutesOfDay(now);
  const trip = state.trip ?? trips.at(-1) ?? null;
  const visits = trip ? tripVisits(trip) : [];
  const upcoming = visits.find((visit) => visit.minute >= current);
  const speed = currentSpeedKmh(route, state, now, (a, b) =>
    Math.abs((stopDistances[a] ?? 0) - (stopDistances[b] ?? 0)),
  );

  return (
    <>
      <SheetHeader
        icon={<RouteBadge id={route.route_id} large />}
        title={`${id}-avtobus`}
        subtitle={(liveBuses.has(id) ? "📡 Jonli · " : "🗓 Jadval bo'yicha · ") + busStatusText(route, state, now)}
        onClose={back}
      />
      <div className="stats">
        <div className="stat">
          <b>{state.status === "moving" ? `${speed} km/soat` : "Turibdi"}</b>
          <span>{state.status === "moving" ? "Tezlik (jadval bo'yicha)" : "Holat"}</span>
        </div>
        <div className="stat">
          <b>{upcoming ? clockOf(upcoming.minute) : "—"}</b>
          <span>{upcoming ? route.stops[upcoming.index]?.name : "Keyingi bekat"}</span>
        </div>
      </div>
      {trip ? (
        <>
          <SectionTitle>
            {state.status === "moving" ? "Joriy reys" : state.status === "waiting" ? "Keyingi reys" : "Oxirgi reys"} ·{" "}
            {terminalName(route, tripDirection(trip) ?? "shaharga")} tomon
          </SectionTitle>
          <ul className="timeline">
            {visits.map((visit) => (
              <li
                key={visit.index}
                className={visit.minute < current ? "passed" : ""}
                onClick={() => open({ name: "stop", index: visit.index })}
              >
                <span className="t-name">{route.stops[visit.index]?.name}</span>
                <span className="t-time">{clockOf(visit.minute)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SectionTitle>Bugungi reyslari</SectionTitle>
      <div className="chips">
        {trips.map((t) => {
          const cls = tripEnd(t) < current ? "chip past" : tripStart(t) <= current ? "chip now" : "chip";
          return (
            <span key={t.bus_id} className={cls}>
              {tripDirection(t) === "shaharga" ? "🏙" : "🏡"} {clockOf(tripStart(t))}
            </span>
          );
        })}
      </div>
    </>
  );
}

// ------------------------------------------------------------------------- jadval
export function TimetableSheet({ route, now, open, back }: SheetProps) {
  const table = route.timetable;
  const current = exactMinutesOfDay(now);
  const rowState = (row: number) => {
    const prefix = !table?.id || table.id === "weekday" ? "" : table.id[0]!.toUpperCase();
    const code = prefix + String(row + 1).padStart(2, "0");
    const legs = route.trips.filter((trip) => trip.bus_id.startsWith(code));
    if (legs.length === 0) return "";
    const start = Math.min(...legs.map(tripStart));
    const end = Math.max(...legs.map(tripEnd));
    return end < current ? "past" : start <= current ? "now" : "";
  };

  return (
    <>
      <SheetHeader
        icon={<RouteBadge id={route.route_id} large />}
        title={`${route.route_id} jadvali`}
        subtitle={table?.label ? `Bugun: ${table.label}` : routeTitle(route)}
        onClose={back}
      />
      {table ? (
        <>
          <div className="tt-wrap">
            <table className="tt">
              <thead>
                <tr>
                  <th>Avt.</th>
                  {table.columns.map((column) => (
                    <th key={column.label}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, k) => (
                  <tr key={k} className={rowState(k)} onClick={() => open({ name: "bus", id: String(row.bus) })}>
                    <td className="bn">
                      <BusNumber value={String(row.bus)} small />
                    </td>
                    {row.cells.map((cell, i) => {
                      const time = /(\d{1,2})[:.](\d{2})/.exec(cell ?? "");
                      const note = (cell ?? "").replace(/(\d{1,2})[:.](\d{2})/, "").trim();
                      return (
                        <td key={i}>
                          {time ? `${time[1]!.padStart(2, "0")}:${time[2]}` : "—"}
                          {note ? <small>{note}</small> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {(table.buses ?? 1) > 1
              ? "Qatorlar avtobuslarga navbat bilan beriladi: 1 → 2 → 3 → 1 … "
              : "Bugun bitta avtobus qatnaydi. "}
            Oraliq bekatlar vaqti guruhdagi o&apos;tish vaqtlaridan hisoblangan.
          </p>
        </>
      ) : (
        <div className="empty">Jadval mavjud emas</div>
      )}
      <SectionTitle>Bekatlar</SectionTitle>
      <ul className="timeline">
        {route.stops.map((stop, index) => (
          <li key={stop.name} onClick={() => open({ name: "stop", index })}>
            <span className="t-name">{stop.name}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
