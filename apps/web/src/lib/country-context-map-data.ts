export type GeoPoint = { lat: number; lon: number };

export type CountryContextCity = {
  id: string;
  name: string;
  point: GeoPoint;
  isCapital?: boolean;
};

export type CountryContextRegion = {
  id: string;
  name: string;
  polygon: GeoPoint[];
};

export type CountryContextOverlay = {
  id: string;
  label: string;
  polyline: GeoPoint[];
};

export type CountryContextMarker = {
  id: string;
  label: string;
  point: GeoPoint;
};

export type CountryContextMapData = {
  countryCode: "IRN" | "USA" | "TUR" | "RUS" | "SAU" | "TJK";
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  outline: GeoPoint[];
  cities: CountryContextCity[];
  regions: CountryContextRegion[];
  overlays: CountryContextOverlay[];
  markers: CountryContextMarker[];
  neighboringLabels?: Array<{ name: string; point: GeoPoint }>;
};

export const COUNTRY_CONTEXT_MAPS: Record<string, CountryContextMapData> = {
  IRN: {
    countryCode: "IRN",
    bbox: { minLat: 24.5, maxLat: 40.5, minLon: 43.5, maxLon: 64.5 },
    outline: [
      { lat: 39.6, lon: 44.0 },
      { lat: 39.1, lon: 46.0 },
      { lat: 38.0, lon: 47.8 },
      { lat: 37.4, lon: 49.5 },
      { lat: 37.2, lon: 51.6 },
      { lat: 37.8, lon: 54.6 },
      { lat: 38.1, lon: 57.8 },
      { lat: 37.3, lon: 60.4 },
      { lat: 35.4, lon: 62.1 },
      { lat: 32.1, lon: 61.8 },
      { lat: 28.5, lon: 60.4 },
      { lat: 25.3, lon: 57.2 },
      { lat: 25.5, lon: 53.9 },
      { lat: 26.1, lon: 50.8 },
      { lat: 27.5, lon: 48.5 },
      { lat: 29.8, lon: 46.2 },
      { lat: 31.9, lon: 45.2 },
      { lat: 34.8, lon: 44.3 },
      { lat: 37.2, lon: 44.0 },
      { lat: 39.6, lon: 44.0 },
    ],
    cities: [
      { id: "tehran", name: "Tehran", point: { lat: 35.6892, lon: 51.389 } , isCapital: true},
      { id: "mashhad", name: "Mashhad", point: { lat: 36.2605, lon: 59.6168 } },
      { id: "isfahan", name: "Isfahan", point: { lat: 32.6546, lon: 51.668 } },
      { id: "tabriz", name: "Tabriz", point: { lat: 38.0962, lon: 46.2738 } },
      { id: "shiraz", name: "Shiraz", point: { lat: 29.5918, lon: 52.5837 } },
      { id: "ahvaz", name: "Ahvaz", point: { lat: 31.3183, lon: 48.6706 } },
    ],
    regions: [],
    overlays: [],
    markers: [],
    neighboringLabels: [
      { name: "Turkey", point: { lat: 39.2, lon: 42.8 } },
      { name: "Iraq", point: { lat: 33.0, lon: 43.7 } },
      { name: "Afghanistan", point: { lat: 33.5, lon: 64.7 } },
      { name: "Pakistan", point: { lat: 27.8, lon: 65.0 } },
    ],
  },
  TUR: {
    countryCode: "TUR",
    bbox: { minLat: 35.0, maxLat: 43.0, minLon: 25.0, maxLon: 45.0 },
    outline: [
      { lat: 40.9, lon: 26.0 },
      { lat: 41.6, lon: 28.0 },
      { lat: 41.7, lon: 30.5 },
      { lat: 41.6, lon: 34.0 },
      { lat: 41.2, lon: 38.5 },
      { lat: 41.0, lon: 41.8 },
      { lat: 39.8, lon: 43.4 },
      { lat: 38.0, lon: 44.0 },
      { lat: 36.9, lon: 42.2 },
      { lat: 36.0, lon: 36.8 },
      { lat: 36.2, lon: 31.0 },
      { lat: 37.1, lon: 27.5 },
      { lat: 39.2, lon: 26.0 },
      { lat: 40.9, lon: 26.0 },
    ],
    cities: [
      { id: "istanbul", name: "Istanbul", point: { lat: 41.0082, lon: 28.9784 } },
      { id: "ankara", name: "Ankara", point: { lat: 39.9334, lon: 32.8597 }, isCapital: true },
      { id: "izmir", name: "Izmir", point: { lat: 38.4237, lon: 27.1428 } },
      { id: "gaziantep", name: "Gaziantep", point: { lat: 37.0662, lon: 37.3833 } },
    ],
    regions: [],
    overlays: [],
    markers: [],
    neighboringLabels: [
      { name: "Greece", point: { lat: 40.5, lon: 24.6 } },
      { name: "Syria", point: { lat: 35.8, lon: 38.6 } },
      { name: "Georgia", point: { lat: 42.4, lon: 42.5 } },
    ],
  },
  RUS: {
    countryCode: "RUS",
    bbox: { minLat: 41.0, maxLat: 70.5, minLon: 20.0, maxLon: 140.0 },
    outline: [
      { lat: 69.5, lon: 30.0 },
      { lat: 69.0, lon: 45.0 },
      { lat: 69.2, lon: 62.0 },
      { lat: 68.4, lon: 80.0 },
      { lat: 69.3, lon: 104.0 },
      { lat: 67.2, lon: 125.0 },
      { lat: 62.0, lon: 138.0 },
      { lat: 56.0, lon: 135.0 },
      { lat: 50.0, lon: 129.0 },
      { lat: 47.0, lon: 116.0 },
      { lat: 44.0, lon: 100.0 },
      { lat: 43.5, lon: 83.0 },
      { lat: 44.0, lon: 66.0 },
      { lat: 46.0, lon: 51.0 },
      { lat: 48.0, lon: 40.0 },
      { lat: 57.0, lon: 30.0 },
      { lat: 64.0, lon: 23.0 },
      { lat: 69.5, lon: 30.0 },
    ],
    cities: [
      { id: "moscow", name: "Moscow", point: { lat: 55.7558, lon: 37.6173 }, isCapital: true },
      { id: "stp", name: "St Petersburg", point: { lat: 59.9311, lon: 30.3609 } },
      { id: "novosibirsk", name: "Novosibirsk", point: { lat: 55.0084, lon: 82.9357 } },
    ],
    regions: [],
    overlays: [],
    markers: [],
    neighboringLabels: [
      { name: "Kazakhstan", point: { lat: 49.0, lon: 67.0 } },
      { name: "Ukraine", point: { lat: 50.0, lon: 28.0 } },
      { name: "China", point: { lat: 48.5, lon: 122.0 } },
    ],
  },
  USA: {
    countryCode: "USA",
    bbox: { minLat: 24.0, maxLat: 49.5, minLon: -125.0, maxLon: -66.0 },
    outline: [
      { lat: 48.9, lon: -124.5 },
      { lat: 47.5, lon: -123.0 },
      { lat: 45.0, lon: -124.0 },
      { lat: 42.0, lon: -124.0 },
      { lat: 38.0, lon: -122.5 },
      { lat: 34.2, lon: -118.5 },
      { lat: 32.5, lon: -117.1 },
      { lat: 31.3, lon: -111.0 },
      { lat: 29.0, lon: -106.5 },
      { lat: 28.5, lon: -97.5 },
      { lat: 26.0, lon: -80.0 },
      { lat: 29.5, lon: -81.0 },
      { lat: 33.0, lon: -79.0 },
      { lat: 37.5, lon: -75.0 },
      { lat: 41.5, lon: -72.0 },
      { lat: 44.0, lon: -69.5 },
      { lat: 47.5, lon: -67.0 },
      { lat: 48.9, lon: -95.0 },
      { lat: 48.9, lon: -124.5 },
    ],
    cities: [
      { id: "dc", name: "Washington DC", point: { lat: 38.9072, lon: -77.0369 }, isCapital: true },
      { id: "nyc", name: "New York", point: { lat: 40.7128, lon: -74.006 } },
      { id: "la", name: "Los Angeles", point: { lat: 34.0522, lon: -118.2437 } },
      { id: "chicago", name: "Chicago", point: { lat: 41.8781, lon: -87.6298 } },
    ],
    regions: [],
    overlays: [],
    markers: [],
    neighboringLabels: [
      { name: "Canada", point: { lat: 49.7, lon: -95.0 } },
      { name: "Mexico", point: { lat: 25.1, lon: -102.0 } },
    ],
  },
  SAU: {
    countryCode: "SAU",
    bbox: { minLat: 15.0, maxLat: 33.5, minLon: 34.0, maxLon: 56.5 },
    outline: [
      { lat: 31.7, lon: 34.7 },
      { lat: 31.0, lon: 39.0 },
      { lat: 30.0, lon: 43.0 },
      { lat: 28.3, lon: 47.8 },
      { lat: 26.2, lon: 50.6 },
      { lat: 24.5, lon: 52.6 },
      { lat: 19.0, lon: 52.0 },
      { lat: 16.8, lon: 45.0 },
      { lat: 17.2, lon: 42.0 },
      { lat: 20.0, lon: 40.2 },
      { lat: 23.0, lon: 38.0 },
      { lat: 26.0, lon: 36.5 },
      { lat: 28.6, lon: 35.2 },
      { lat: 31.7, lon: 34.7 },
    ],
    cities: [
      { id: "riyadh", name: "Riyadh", point: { lat: 24.7136, lon: 46.6753 }, isCapital: true },
      { id: "jeddah", name: "Jeddah", point: { lat: 21.4858, lon: 39.1925 } },
      { id: "dammam", name: "Dammam", point: { lat: 26.4207, lon: 50.0888 } },
    ],
    regions: [],
    overlays: [],
    markers: [],
    neighboringLabels: [
      { name: "Jordan", point: { lat: 31.5, lon: 36.2 } },
      { name: "Iraq", point: { lat: 30.8, lon: 44.0 } },
      { name: "Yemen", point: { lat: 16.6, lon: 47.0 } },
    ],
  },
  TJK: {
    countryCode: "TJK",
    bbox: { minLat: 36.0, maxLat: 41.3, minLon: 66.5, maxLon: 75.5 },
    outline: [
      { lat: 40.9, lon: 67.3 },
      { lat: 40.7, lon: 69.6 },
      { lat: 40.0, lon: 71.5 },
      { lat: 39.6, lon: 73.0 },
      { lat: 38.6, lon: 74.5 },
      { lat: 37.2, lon: 74.0 },
      { lat: 36.8, lon: 71.4 },
      { lat: 36.9, lon: 69.8 },
      { lat: 37.4, lon: 68.2 },
      { lat: 38.3, lon: 67.1 },
      { lat: 39.2, lon: 66.9 },
      { lat: 40.1, lon: 67.0 },
      { lat: 40.9, lon: 67.3 },
    ],
    cities: [
      { id: "dushanbe", name: "Dushanbe", point: { lat: 38.5598, lon: 68.787 }, isCapital: true },
      { id: "bokhtar", name: "Bokhtar (Qurghonteppa)", point: { lat: 37.835, lon: 68.78 } },
      { id: "kulob", name: "Kulob", point: { lat: 37.9146, lon: 69.7847 } },
    ],
    regions: [
      {
        id: "southern-lowland",
        name: "Southern lowland heat corridor",
        polygon: [
          { lat: 37.3, lon: 67.8 },
          { lat: 37.1, lon: 70.8 },
          { lat: 38.1, lon: 70.9 },
          { lat: 38.4, lon: 68.0 },
          { lat: 37.3, lon: 67.8 },
        ],
      },
    ],
    overlays: [
      {
        id: "dushanbe-bokhtar-kulob-route",
        label: "Approximate route chain",
        polyline: [
          { lat: 38.5598, lon: 68.787 },
          { lat: 37.835, lon: 68.78 },
          { lat: 37.9146, lon: 69.7847 },
        ],
      },
    ],
    markers: [],
    neighboringLabels: [
      { name: "Uzbekistan", point: { lat: 39.9, lon: 66.7 } },
      { name: "Kyrgyzstan", point: { lat: 40.8, lon: 73.5 } },
      { name: "Afghanistan", point: { lat: 37.1, lon: 71.8 } },
    ],
  },
};
