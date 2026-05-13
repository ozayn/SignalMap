"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COUNTRY_CONTEXT_MAPS, type GeoPoint } from "@/lib/country-context-map-data";

type Props = {
  countryCode: string;
  countryName: string;
};

const MAP_W = 900;
const MAP_H = 440;
const PAD = 34;

function projectPoint(point: GeoPoint, bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  const x =
    PAD + ((point.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon || 1)) * (MAP_W - PAD * 2);
  const y =
    MAP_H - PAD - ((point.lat - bbox.minLat) / (bbox.maxLat - bbox.minLat || 1)) * (MAP_H - PAD * 2);
  return { x, y };
}

function polyToPath(
  points: GeoPoint[],
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): string {
  if (points.length === 0) return "";
  const p0 = projectPoint(points[0]!, bbox);
  const rest = points
    .slice(1)
    .map((p) => {
      const pp = projectPoint(p, bbox);
      return `L ${pp.x.toFixed(1)} ${pp.y.toFixed(1)}`;
    })
    .join(" ");
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ${rest} Z`;
}

function linePath(
  points: GeoPoint[],
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): string {
  if (points.length === 0) return "";
  const p0 = projectPoint(points[0]!, bbox);
  const rest = points
    .slice(1)
    .map((p) => {
      const pp = projectPoint(p, bbox);
      return `L ${pp.x.toFixed(1)} ${pp.y.toFixed(1)}`;
    })
    .join(" ");
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ${rest}`;
}

export function CountryContextMap({ countryCode, countryName }: Props) {
  const context = COUNTRY_CONTEXT_MAPS[countryCode.toUpperCase()];
  if (!context) return null;

  return (
    <Card className="border-border bg-muted/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Country context map</CardTitle>
        <p className="text-xs text-muted-foreground">
          Editorial atlas view of {countryName}: capital, major cities, and regional orientation.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="h-56 w-full rounded-md border border-border/70 bg-[hsl(210,18%,95%)] md:h-64"
          role="img"
          aria-label={`${countryName} context map`}
        >
          <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="hsl(210, 20%, 94%)" />

          {context.regions.map((r) => (
            <path
              key={r.id}
              d={polyToPath(r.polygon, context.bbox)}
              fill="rgba(59, 130, 246, 0.10)"
              stroke="rgba(59, 130, 246, 0.22)"
              strokeWidth="1"
            />
          ))}

          <path
            d={polyToPath(context.outline, context.bbox)}
            fill="hsl(210, 18%, 86%)"
            stroke="hsl(210, 10%, 38%)"
            strokeWidth="1.2"
          />

          {context.overlays.map((o) => (
            <path
              key={o.id}
              d={linePath(o.polyline, context.bbox)}
              fill="none"
              stroke="hsl(220, 16%, 42%)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
          ))}

          {context.neighboringLabels?.map((n) => {
            const p = projectPoint(n.point, context.bbox);
            return (
              <text
                key={n.name}
                x={p.x}
                y={p.y}
                fontSize="11"
                textAnchor="middle"
                fill="hsl(210, 9%, 45%)"
              >
                {n.name}
              </text>
            );
          })}

          {context.cities.map((city) => {
            const p = projectPoint(city.point, context.bbox);
            return (
              <g key={city.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={city.isCapital ? 4.3 : 3.2}
                  fill={city.isCapital ? "hsl(216, 92%, 38%)" : "hsl(220, 16%, 28%)"}
                />
                <text
                  x={p.x + 6}
                  y={p.y - 6}
                  fontSize="11"
                  fill="hsl(215, 18%, 24%)"
                >
                  {city.name}
                </text>
                <title>{city.name}</title>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-xs text-muted-foreground">
          Minimal map style by design: this layer is built for lightweight context and future overlays (regional indicators, elections, migration, trade routes, climate, and travel/photo notes).
        </p>
      </CardContent>
    </Card>
  );
}
