import Link from "next/link";
import { HomePreviewSectionLazy } from "@/components/home-preview-loader";

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="home-hero">
        <h1>SignalMap</h1>
        <p className="hero-subtitle">
          Interactive studies of macroeconomic signals, historical periods, and public discourse.
        </p>

        <p className="hero-description">
          SignalMap surfaces long-run patterns across economies, events, and social data
          without forcing causal claims.
        </p>

        <Link href="/studies" className="hero-button">
          Browse Studies
        </Link>
      </div>

      <HomePreviewSectionLazy />
    </div>
  );
}
