import { notFound } from "next/navigation";
import { CountryEconomyStudy } from "@/components/studies/country-economy-study";
import { getCountryEconomyConfig } from "@/lib/country-economy-config";

export default function TurkeyEconomyStudyPage() {
  const cfg = getCountryEconomyConfig("turkey-economy");
  if (!cfg) return notFound();
  return (
    <div className="studies-container py-8">
      <CountryEconomyStudy
        countryCode={cfg.countryCode}
        countryName={cfg.countryName}
        focusPresets={cfg.focusPresets}
        rangePresets={cfg.rangePresets}
        overlays={{ events: cfg.overlayEvents, bands: cfg.overlayBands }}
        hasFX={cfg.hasFX}
        defaultFxLog={cfg.defaultFxLog}
      />
    </div>
  );
}
