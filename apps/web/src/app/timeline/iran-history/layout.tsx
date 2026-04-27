import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iranian dynasties — SignalMap",
  description: "A vertical band timeline of major Iranian polities, present at the top, past below.",
};

export default function IranHistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
