import { NextResponse } from "next/server";

/**
 * Curated global crude oil trade flows (approximate, ~2023).
 * Values in thousand barrels/day. Direction: exporter → importer.
 * Nodes are derived from edges to avoid duplication.
 */
const EDGES: { source: string; target: string; value: number }[] = [
  { source: "Saudi Arabia", target: "China", value: 1700 },
  { source: "Saudi Arabia", target: "India", value: 900 },
  { source: "Saudi Arabia", target: "Japan", value: 600 },
  { source: "Russia", target: "China", value: 1200 },
  { source: "Russia", target: "India", value: 1600 },
  { source: "Russia", target: "EU", value: 1100 },
  { source: "United States", target: "EU", value: 800 },
  { source: "United States", target: "South Korea", value: 500 },
  { source: "United States", target: "Japan", value: 400 },
  { source: "Iran", target: "China", value: 700 },
  { source: "Iraq", target: "China", value: 800 },
  { source: "Iraq", target: "India", value: 600 },
  { source: "UAE", target: "Japan", value: 500 },
  { source: "UAE", target: "India", value: 900 },
  { source: "UAE", target: "China", value: 400 },
];

function deriveNodesFromEdges(
  edges: { source: string; target: string }[]
): { id: string }[] {
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.source);
    ids.add(e.target);
  }
  return [...ids].sort().map((id) => ({ id }));
}

export async function GET() {
  const nodes = deriveNodesFromEdges(EDGES);
  const edges = EDGES;
  return NextResponse.json({ nodes, edges });
}
