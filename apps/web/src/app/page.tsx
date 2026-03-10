import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="home-hero">
      <h1>SignalMap</h1>
      <p className="hero-subtitle">
        Longitudinal studies of emotion, language, and interaction in public discourse.
      </p>

      <p className="hero-description">
        SignalMap privileges discovery over hypothesis testing. The platform surfaces
        temporal patterns in public discourse before formal hypotheses are formulated.
      </p>

      <Link href="/studies" className="hero-button">
        Browse Studies
      </Link>
    </div>
    </div>
  );
}
