/** Ma'lumot yuklanayotgandagi joy egallovchi ko'rinish. */
export function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-6 w-2/3 rounded-lg bg-[var(--color-surface-alt)]" />
      <div className="h-36 rounded-2xl bg-[var(--color-surface-alt)]" />
      <div className="flex gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-9 w-24 rounded-full bg-[var(--color-surface-alt)]" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-2xl bg-[var(--color-surface-alt)]" />
        <div className="h-32 rounded-2xl bg-[var(--color-surface-alt)]" />
      </div>
    </div>
  );
}
