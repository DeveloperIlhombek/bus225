"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sahifa xatosi:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-lg font-semibold">Nimadir noto&apos;g&apos;ri ketdi</h1>
      <p className="max-w-xs text-sm text-[var(--color-muted)]">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]"
      >
        Qayta urinish
      </button>
    </main>
  );
}
