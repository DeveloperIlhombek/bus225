/**
 * Pastki panelda ishlatiladigan kichik, holatsiz ko'rinish bloklari.
 */
import type { ReactNode } from "react";

export const Icon = {
  search: (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="2.3" fill="none" />
      <path d="M15.8 15.8L21 21" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  ),
  go: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#111" />
      <path d="M10 7.5l4.5 4.5-4.5 4.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#9e9e9e" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  stop: (size = 16) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#fff" d="M7 3h10a3 3 0 0 1 3 3v10a2 2 0 0 1-1 1.73V20a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.5h-7V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2.27A2 2 0 0 1 4 16V6a3 3 0 0 1 3-3zm-.5 4v4.5h11V7h-11zM7.5 14a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" />
    </svg>
  ),
};

export function RouteBadge({ id, large = false }: { id: string; large?: boolean }) {
  return <span className={large ? "badge lg" : "badge"}>{id}</span>;
}

export function BusNumber({ value, small = false }: { value: string; small?: boolean }) {
  return <span className={small ? "busnum sm" : "busnum"}>{value}</span>;
}

export function StopIcon({ large = false }: { large?: boolean }) {
  return <span className={large ? "stop-pin lg" : "stop-pin"}>{Icon.stop(large ? 26 : 15)}</span>;
}

interface ItemProps {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly end?: ReactNode;
  readonly endSoon?: boolean;
  readonly onClick?: () => void;
}

export function Item({ icon, title, subtitle, end, endSoon, onClick }: ItemProps) {
  return (
    <li>
      <button type="button" className="item" onClick={onClick}>
        <span className="item-icon">{icon}</span>
        <span className="item-text">
          <span className="item-title">{title}</span>
          {subtitle ? <span className="item-sub">{subtitle}</span> : null}
        </span>
        {end ? <span className={endSoon ? "item-end soon" : "item-end"}>{end}</span> : null}
      </button>
    </li>
  );
}

export function SheetHeader({
  icon,
  title,
  subtitle,
  onClose,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="sheet-head">
      {icon}
      <div className="grow">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <button type="button" className="close" onClick={onClose} aria-label="Yopish">
        {Icon.close}
      </button>
    </div>
  );
}

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <div className="section-title">{children}</div>
);
