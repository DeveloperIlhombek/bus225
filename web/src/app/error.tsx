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
    <main className="fatal">
      <p className="fatal-emoji">⚠️</p>
      <h1>Nimadir noto&apos;g&apos;ri ketdi</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>
        Qayta urinish
      </button>
    </main>
  );
}
