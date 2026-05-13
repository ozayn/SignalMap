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
  routeSlug:
    | "us-economy"
    | "russia-economy"
    | "turkey-economy"
    | "saudi-arabia-economy"
    | "tajikistan-economy";
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
      { id: "putin2", label: "Putin II (2012-present)", startYear: 2012, endYear: null },
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
      { id: "pre-2003", label: "Pre-2003 (1960-2002)", shortLabel: "Pre-2003", startYear: 1960, endYear: 2002 },
      { id: "erdogan-1", label: "Erdogan I: 2003-2013", shortLabel: "Erdogan I", startYear: 2003, endYear: 2013 },
      { id: "erdogan-2", label: "Erdogan II: 2013-2018", shortLabel: "Erdogan II", startYear: 2013, endYear: 2018 },
      { id: "erdogan-3", label: "Erdogan III: 2018-present", shortLabel: "Erdogan III", startYear: 2018, endYear: null },
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
  {
    routeSlug: "saudi-arabia-economy",
    countryCode: "SAU",
    countryName: "Saudi Arabia",
    hasFX: false,
    defaultFxLog: false,
    focusPresets: [
      { id: "fahd", label: "King Fahd (1982-2005)", shortLabel: "Fahd", startYear: 1982, endYear: 2005 },
      { id: "abdullah", label: "King Abdullah (2005-2015)", shortLabel: "Abdullah", startYear: 2005, endYear: 2015 },
      {
        id: "salman-vision2030",
        label: "King Salman / Vision 2030 (2015-present)",
        shortLabel: "Salman / Vision 2030",
        startYear: 2015,
        endYear: null,
      },
      {
        id: "vision-2030",
        label: "Vision 2030 period (2016-present)",
        shortLabel: "Vision 2030",
        startYear: 2016,
        endYear: null,
      },
    ],
    rangePresets: [
      { id: "full", label: "Full history", startYear: 1960, endYear: null },
      { id: "post-1980", label: "Post-1980", startYear: 1980, endYear: null },
      { id: "vision-era", label: "Vision era (2016-)", startYear: 2016, endYear: null },
    ],
    overlayEvents: [
      {
        id: "sau-oil-collapse-1986",
        layer: "world_core",
        date: "1986-01-01",
        title: "1986 oil price collapse",
        title_fa: "سقوط قیمت نفت ۱۹۸۶",
      },
      {
        id: "sau-gulf-war-1990",
        layer: "world_core",
        date: "1990-08-01",
        title: "1990-1991 Gulf War",
        title_fa: "جنگ خلیج فارس ۱۹۹۰-۱۹۹۱",
      },
      {
        id: "sau-gfc-2008",
        layer: "world_core",
        date: "2008-09-15",
        title: "2008 financial crisis",
        title_fa: "بحران مالی ۲۰۰۸",
      },
      {
        id: "sau-oil-collapse-2014",
        layer: "world_core",
        date: "2014-11-27",
        title: "2014 oil price collapse",
        title_fa: "سقوط قیمت نفت ۲۰۱۴",
      },
      {
        id: "sau-vision-2030-launch",
        layer: "world_core",
        date: "2016-04-25",
        title: "Vision 2030 launch",
        title_fa: "آغاز چشم‌انداز ۲۰۳۰",
      },
      {
        id: "sau-oil-covid-2020",
        layer: "world_core",
        date: "2020-03-01",
        title: "2020 oil/COVID shock",
        title_fa: "شوک نفت/کووید ۲۰۲۰",
      },
    ],
    overlayBands: [
      {
        id: "sau-gulf-war-band",
        startYear: 1990,
        endYear: 1991,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "Gulf War",
      },
      {
        id: "sau-gfc-band",
        startYear: 2008,
        endYear: 2009,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "2008 crisis",
      },
      {
        id: "sau-oil-collapse-2014-band",
        startYear: 2014,
        endYear: 2016,
        fill: "rgba(148, 163, 184, 0.12)",
        markAreaLabel: "Oil price collapse",
      },
      {
        id: "sau-vision2030-band",
        startYear: 2016,
        endYear: THIS_YEAR,
        fill: "rgba(148, 163, 184, 0.10)",
        markAreaLabel: "Vision 2030",
      },
      {
        id: "sau-2020-shock-band",
        startYear: 2020,
        endYear: 2020,
        fill: "rgba(148, 163, 184, 0.10)",
      },
    ],
  },
  {
    routeSlug: "tajikistan-economy",
    countryCode: "TJK",
    countryName: "Tajikistan",
    hasFX: true,
    defaultFxLog: true,
    focusPresets: [
      {
        id: "soviet-context",
        label: "Soviet / pre-independence context (if available)",
        shortLabel: "Soviet context",
        startYear: 1960,
        endYear: 1991,
      },
      {
        id: "independence-civil-war",
        label: "Independence and civil war (1991-1997)",
        shortLabel: "1991-1997",
        startYear: 1991,
        endYear: 1997,
      },
      {
        id: "post-war-stabilization",
        label: "Post-war stabilization (1997-2005)",
        shortLabel: "1997-2005",
        startYear: 1997,
        endYear: 2005,
      },
      {
        id: "remittance-led-growth",
        label: "Remittance-led growth period (2005-2014)",
        shortLabel: "2005-2014",
        startYear: 2005,
        endYear: 2014,
      },
      {
        id: "recent-period",
        label: "Recent period (2015-present)",
        shortLabel: "2015-present",
        startYear: 2015,
        endYear: null,
      },
    ],
    rangePresets: [
      { id: "full", label: "Full history", startYear: 1960, endYear: null },
      { id: "post-independence", label: "Post-independence (1991-)", startYear: 1991, endYear: null },
      { id: "recent", label: "Recent (2005-)", startYear: 2005, endYear: null },
    ],
    overlayEvents: [
      {
        id: "tjk-independence-1991",
        layer: "world_core",
        date: "1991-09-09",
        title: "Independence from USSR (1991)",
        title_fa: "استقلال از شوروی (۱۹۹۱)",
      },
      {
        id: "tjk-civil-war-start-1992",
        layer: "world_core",
        date: "1992-05-01",
        title: "Civil war begins (1992)",
        title_fa: "آغاز جنگ داخلی (۱۹۹۲)",
      },
      {
        id: "tjk-peace-1997",
        layer: "world_core",
        date: "1997-06-27",
        title: "Peace agreement (1997)",
        title_fa: "توافق صلح (۱۹۹۷)",
      },
      {
        id: "tjk-remittance-era-2000s",
        layer: "world_core",
        date: "2005-01-01",
        title: "Labor migration / remittance dependence (2000s)",
        title_fa: "وابستگی به مهاجرت کار و حواله (دهه ۲۰۰۰)",
      },
      {
        id: "tjk-covid-2020",
        layer: "world_core",
        date: "2020-03-01",
        title: "COVID period",
        title_fa: "دوره کووید",
      },
    ],
    overlayBands: [
      {
        id: "tjk-civil-war-band",
        startYear: 1992,
        endYear: 1997,
        fill: "rgba(148, 163, 184, 0.14)",
        markAreaLabel: "Civil war",
      },
      {
        id: "tjk-remittance-band",
        startYear: 2005,
        endYear: 2014,
        fill: "rgba(148, 163, 184, 0.10)",
        markAreaLabel: "Remittance-led growth",
      },
      {
        id: "tjk-covid-band",
        startYear: 2020,
        endYear: 2021,
        fill: "rgba(148, 163, 184, 0.10)",
        markAreaLabel: "COVID period",
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
