"use client";

import type { ActiveBus, Route } from "@/types/route";

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 150;
const PADDING_X = 26;
const TRACK_WIDTH = VIEW_WIDTH - PADDING_X * 2;

/*
 * Vertikal joylashuv. Uch qavat bir-birining ustiga tushmasligi uchun
 * qat'iy ajratilgan:
 *   yuqorida  — shaharga ketayotgan avtobuslar
 *   o'rtada   — chiziq, bekat nuqtalari va ularning nomlari
 *   pastda    — qishloqqa ketayotgan avtobuslar
 */
const LINE_Y = 58;
const STOP_LABEL_Y = LINE_Y + 16;
const NEAREST_LABEL_Y = LINE_Y + 26;
const BUS_Y = { shaharga: LINE_Y - 26, qishloqqa: LINE_Y + 46 } as const;
const BUS_ARROW_DY = { shaharga: -14, qishloqqa: 21 } as const;

interface RouteMapProps {
  readonly route: Route;
  readonly buses: readonly ActiveBus[];
  readonly nearestStopIndex: number | null;
  readonly selectedStopIndex: number;
  readonly onSelectStop: (index: number) => void;
}

/**
 * Yo'nalishning sxematik ko'rinishi: gorizontal chiziq, ustida bekatlar,
 * chiziq bo'ylab harakatlanuvchi avtobuslar.
 *
 * Xarita ataylab soddalashtirilgan — haqiqiy geografiya emas, balki
 * "avtobus qayerda va qachon keladi" degan savolga javob beradi.
 */
export function RouteMap({
  route,
  buses,
  nearestStopIndex,
  selectedStopIndex,
  onSelectStop,
}: RouteMapProps) {
  const stopCount = route.stops.length;
  const xOf = (position: number): number =>
    PADDING_X + (TRACK_WIDTH * position) / (stopCount - 1);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={`${route.route_name} sxemasi, ${buses.length} ta avtobus yo'lda`}
    >
      <line
        x1={PADDING_X}
        y1={LINE_Y}
        x2={VIEW_WIDTH - PADDING_X}
        y2={LINE_Y}
        stroke="var(--color-line)"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {route.stops.map((stop, index) => {
        const cx = xOf(index);
        const isNearest = index === nearestStopIndex;
        const isSelected = index === selectedStopIndex;

        return (
          <g
            key={stop.name}
            onClick={() => onSelectStop(index)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={stop.name}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelectStop(index);
            }}
          >
            {/* Bosish maydonini kengaytirish uchun ko'rinmas doira */}
            <circle cx={cx} cy={LINE_Y} r={16} fill="transparent" />
            <circle
              cx={cx}
              cy={LINE_Y}
              r={isSelected ? 7 : 5}
              fill={isSelected ? "var(--color-accent)" : "var(--color-surface)"}
              stroke={isNearest ? "var(--color-village)" : "var(--color-line)"}
              strokeWidth={isNearest ? 3 : 2}
            />
            <text
              x={cx}
              y={STOP_LABEL_Y}
              textAnchor="middle"
              fontSize={8}
              fill={isSelected ? "var(--color-ink)" : "var(--color-muted)"}
              fontWeight={isSelected ? 600 : 400}
            >
              {stop.name.length > 12 ? `${stop.name.slice(0, 11)}…` : stop.name}
            </text>
            {isNearest ? (
              <text x={cx} y={NEAREST_LABEL_Y} textAnchor="middle" fontSize={7} fill="var(--color-village)">
                siz shu yerda
              </text>
            ) : null}
          </g>
        );
      })}

      {buses.map((bus) => {
        const x = xOf(bus.position);
        const y = BUS_Y[bus.direction];
        const color = bus.direction === "shaharga" ? "var(--color-city)" : "var(--color-village)";

        return (
          <g key={bus.busId} className="bus-marker" style={{ transform: `translate(${x}px, ${y}px)` }}>
            <rect x={-13} y={-9} width={26} height={18} rx={5} fill={color} />
            <text x={0} y={4} textAnchor="middle" fontSize={9} fill="#ffffff" fontWeight={600}>
              {bus.busId}
            </text>
            <text x={0} y={BUS_ARROW_DY[bus.direction]} textAnchor="middle" fontSize={9}>
              {bus.meetingWith ? "🤝" : bus.direction === "shaharga" ? "▶" : "◀"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
