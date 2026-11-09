import type { Metadata } from "next";
import { DriverScreen } from "@/components/DriverScreen";

export const metadata: Metadata = {
  title: "225 — haydovchi paneli",
  robots: { index: false },
};

export default function DriverPage() {
  return <DriverScreen />;
}
