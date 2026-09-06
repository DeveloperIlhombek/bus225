import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">🚏</p>
      <h1 className="text-lg font-semibold">Sahifa topilmadi</h1>
      <Link
        href="/"
        className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]"
      >
        Bosh sahifaga
      </Link>
    </main>
  );
}
