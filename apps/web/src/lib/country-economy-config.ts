import type { ChartPeriodOverlayBandInput } from "@/lib/iran-iraq-war-chart-overlay";
import type { TimelineEvent } from "@/components/timeline-chart";

export type CountryFocusPreset = {
  id: string;
  label: string;
  shortLabel?: string;
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
      { id: "fdr", label: "Franklin D. Roosevelt (1933-1945)", shortLabel: "FDR", startYear: 1933, endYear: 1945 },
      { id: "truman", label: "Truman (1945-1953)", shortLabel: "Truman", startYear: 1945, endYear: 1953 },
      { id: "eisenhower", label: "Eisenhower (1953-1961)", shortLabel: "Eisenhower", startYear: 1953, endYear: 1961 },
      { id: "jfk-lbj", label: "Kennedy / Johnson (1961-1969)", shortLabel: "JFK/LBJ", startYear: 1961, endYear: 1969 },
      { id: "nixon-ford", label: "Nixon / Ford (1969-1977)", shortLabel: "Nixon/Ford", startYear: 1969, endYear: 1977 },
      { id: "carter", label: "Carter (1977-1981)", shortLabel: "Carter", startYear: 1977, endYear: 1981 },
      { id: "reagan", label: "Reagan (1981-1989)", shortLabel: "Reagan", startYear: 1981, endYear: 1989 },
      {
        id: "bush-sr",
        label: "George H. W. Bush (1989-1993)",
        shortLabel: "Bush Sr.",
        startYear: 1989,
        endYear: 1993,
      },
      { id: "clinton", label: "Clinton (1993-2001)", shortLabel: "Clinton", startYear: 1993, endYear: 2001 },
      {
        id: "bush-jr",
        label: "George W. Bush (2001-2009)",
        shortLabel: "Bush Jr.",
        startYear: 2001,
        endYear: 2009,
      },
      { id: "obama", label: "Obama (2009-2017)", shortLabel: "Obama", startYear: 2009, endYear: 2017 },
      { id: "trump-1", label: "Trump I (2017-2021)", shortLabel: "Trump I", startYear: 2017, endYear: 2021 },
      { id: "biden", label: "Biden (2021-2025)", shortLabel: "Biden", startYear: 2021, endYear: 2025 },
      { id: "trump-2", label: "Trump II (2025-present)", shortLabel: "Trump II", startYear: 2025, endYear: null },
    ],
    rangePresets: [
      { id: "modern", label: "Modern era (1980-)", startYear: 1980, endYear: null },
      { id: "postwar", label: "Postwar (1945-)", startYear: 1945, endYear: null },
      { id: "full", label: "Full history (1933-)", startYear: 1933, endYear: null },
    ],
    overlayEvents: [
      { id: "usa-covid-2020", layer: "world_core", date: "2020-03-01", title: "COVID shock", title_fa: "شوک کووید" },
    ],
    overlayBands: [
      {
        id: "usa-recession-1973-1975",
        startYear: 1973,
        endYear: 1975,
        fill: "rgba(148, 163, 184, 0.10)",
        markAreaLabel: "U.S. recession",
      },
      {
        id: "usa-recession-1980",
        startYear: 1980,
        endYear: 1980,
        fill: "rgba(148, 163, 184, 0.10)",
      },
      {
        id: "usa-recession-1981-1982",
        startYear: 1981,
        endYear: 1982,
        fill: "rgba(148, 163, 184, 0.10)",
      },
      {
        id: "usa-recession-1990-1991",
        startYear: 1990,
        endYear: 1991,
        fill: "rgba(148, 163, 184, 0.10)",
      },
      {
        id: "usa-recession-2001",
        startYear: 2001,
        endYear: 2001,
        fill: "rgba(148, 163, 184, 0.10)",
      },
      {
        id: "usa-gfc-2008",
        startYear: 2008,
        endYear: 2009,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "2008 Financial Crisis",
      },
      {
        id: "usa-recession-2020",
        startYear: 2020,
        endYear: 2020,
        fill: "rgba(148, 163, 184, 0.10)",
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
      { id: "pre-2003", label: "Pre-2003", shortLabel: "Pre-2003", startYear: 1960, endYear: 2002 },
      { id: "erdogan-1", label: "Erdogan I (2003-2013)", shortLabel: "Erdogan I", startYear: 2003, endYear: 2013 },
      { id: "erdogan-2", label: "Erdogan II (2013-2018)", shortLabel: "Erdogan II", startYear: 2013, endYear: 2018 },
      { id: "erdogan-3", label: "Erdogan III (2018-present)", shortLabel: "Erdogan III", startYear: 2018, endYear: null },
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
      {
        id: "tur-2021-fx-shock",
        layer: "world_core",
        date: "2021-12-01",
        title: "2021 FX shock",
        title_fa: "شوک ارزی ۲۰۲۱",
      },
      {
        id: "tur-covid-2020",
        layer: "world_core",
        date: "2020-03-01",
        title: "COVID shock",
        title_fa: "شوک کووید",
      },
    ],
    overlayBands: [
      {
        id: "tur-crisis-2001-band",
        startYear: 2001,
        endYear: 2002,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "2001 crisis",
      },
      {
        id: "tur-crisis-2018-band",
        startYear: 2018,
        endYear: 2019,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "2018 currency crisis",
      },
      {
        id: "tur-fx-shock-2021-band",
        startYear: 2021,
        endYear: 2021,
        fill: "rgba(148, 163, 184, 0.10)",
      },
      {
        id: "tur-covid-2020-band",
        startYear: 2020,
        endYear: 2020,
        fill: "rgba(148, 163, 184, 0.10)",
      },
    ],
  },
];

export function getCountryEconomyConfig(slug: string): CountryEconomyConfig | null {
  return COUNTRY_ECONOMY_CONFIGS.find((c) => c.routeSlug === slug) ?? null;
}

export function resolvePresetEndYear(endYear: number | null): number {
  return endYear ?? THIS_YEAR;
}
