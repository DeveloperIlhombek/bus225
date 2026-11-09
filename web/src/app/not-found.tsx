import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fatal">
      <p className="fatal-emoji">🚏</p>
      <h1>Sahifa topilmadi</h1>
      <Link href="/" className="fatal-link">
        Bosh sahifaga
      </Link>
    </main>
  );
}
