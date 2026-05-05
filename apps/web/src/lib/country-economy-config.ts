import type { ChartPeriodOverlayBandInput } from "@/lib/iran-iraq-war-chart-overlay";
import type { TimelineEvent } from "@/components/timeline-chart";

export type CountryFocusPreset = {
  id: string;
  label: string;
  startYear: number;
  endYear: number | null;
};

export type CountryRangePreset = {
  id: string;
  label: string;
  startYear: number;
  endYear: number | null;
};

export type CountryEconomyConfig = {
  routeSlug: "us-economy" | "russia-economy" | "turkey-economy";
  countryCode: string;
  countryName: string;
  hasFX: boolean;
  defaultFxLog: boolean;
  focusPresets: CountryFocusPreset[];
  rangePresets: CountryRangePreset[];
  overlayEvents: TimelineEvent[];
  overlayBands: ChartPeriodOverlayBandInput[];
};

const THIS_YEAR = new Date().getUTCFullYear();

export const COUNTRY_ECONOMY_CONFIGS: CountryEconomyConfig[] = [
  {
    routeSlug: "us-economy",
    countryCode: "USA",
    countryName: "United States",
    hasFX: false,
    defaultFxLog: false,
    focusPresets: [
      { id: "reagan", label: "Reagan (1981-1989)", startYear: 1981, endYear: 1989 },
      { id: "clinton", label: "Clinton (1993-2001)", startYear: 1993, endYear: 2001 },
      { id: "bush", label: "Bush (2001-2009)", startYear: 2001, endYear: 2009 },
      { id: "obama", label: "Obama (2009-2017)", startYear: 2009, endYear: 2017 },
      { id: "trump", label: "Trump (2017-2021)", startYear: 2017, endYear: 2021 },
      { id: "biden", label: "Biden (2021-)", startYear: 2021, endYear: null },
    ],
    rangePresets: [
      { id: "full", label: "Full history", startYear: 1960, endYear: null },
      { id: "modern", label: "Modern era (1980-)", startYear: 1980, endYear: null },
    ],
    overlayEvents: [
      { id: "usa-covid-2020", layer: "world_core", date: "2020-03-01", title: "COVID shock", title_fa: "شوک کووید" },
    ],
    overlayBands: [
      {
        id: "usa-gfc-2008",
        startYear: 2008,
        endYear: 2009,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "2008 Financial Crisis",
      },
    ],
  },
  {
    routeSlug: "russia-economy",
    countryCode: "RUS",
    countryName: "Russia",
    hasFX: true,
    defaultFxLog: true,
    focusPresets: [
      { id: "yeltsin", label: "Yeltsin (1991-1999)", startYear: 1991, endYear: 1999 },
      { id: "putin1", label: "Putin I (2000-2008)", startYear: 2000, endYear: 2008 },
      { id: "medvedev", label: "Medvedev (2008-2012)", startYear: 2008, endYear: 2012 },
      { id: "putin2", label: "Putin II (2012-)", startYear: 2012, endYear: null },
    ],
    rangePresets: [
      { id: "full", label: "Full history", startYear: 1960, endYear: null },
      { id: "post-ussr", label: "Post-USSR (1991-)", startYear: 1991, endYear: null },
    ],
    overlayEvents: [
      { id: "rus-ussr-collapse-1991", layer: "world_core", date: "1991-12-26", title: "USSR collapse", title_fa: "فروپاشی شوروی" },
      { id: "rus-crimea-2014", layer: "world_core", date: "2014-03-18", title: "Crimea (2014)", title_fa: "کریمه (۲۰۱۴)" },
      { id: "rus-ukraine-war-2022", layer: "world_core", date: "2022-02-24", title: "Ukraine war (2022)", title_fa: "جنگ اوکراین (۲۰۲۲)" },
    ],
    overlayBands: [],
  },
  {
    routeSlug: "turkey-economy",
    countryCode: "TUR",
    countryName: "Turkey",
    hasFX: true,
    defaultFxLog: true,
    focusPresets: [
      { id: "erdogan-all", label: "Erdogan (2003-)", startYear: 2003, endYear: null },
      { id: "erdogan-pre-2013", label: "Erdogan (pre-2013)", startYear: 2003, endYear: 2013 },
      { id: "erdogan-post-2018", label: "Erdogan (post-2018 crisis)", startYear: 2018, endYear: null },
    ],
    rangePresets: [
      { id: "full", label: "Full history", startYear: 1960, endYear: null },
      { id: "post-2000", label: "Post-2000", startYear: 2000, endYear: null },
    ],
    overlayEvents: [
      {
        id: "tur-2001-crisis",
        layer: "world_core",
        date: "2001-02-01",
        title: "2001 financial crisis",
        title_fa: "بحران مالی ۲۰۰۱",
      },
      {
        id: "tur-2018-crisis",
        layer: "world_core",
        date: "2018-08-01",
        title: "2018 currency crisis",
        title_fa: "بحران ارزی ۲۰۱۸",
      },
    ],
    overlayBands: [],
  },
];

export function getCountryEconomyConfig(slug: string): CountryEconomyConfig | null {
  return COUNTRY_ECONOMY_CONFIGS.find((c) => c.routeSlug === slug) ?? null;
}

export function resolvePresetEndYear(endYear: number | null): number {
  return endYear ?? THIS_YEAR;
}
