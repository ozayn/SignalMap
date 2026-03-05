export type OilTradeEdge = { source: string; target: string; value: number };
export type OilTradeNode = { id: string };

const TOP_FLOWS_LIMIT = 120;
const TOP_COUNTRIES_NETWORK = 30;
const TOP_EXPORTERS_SANKEY = 15;
const TOP_IMPORTERS_SANKEY = 15;

/** Compute total exports and imports from edges. */
function computeTotals(edges: OilTradeEdge[]) {
  const totalExports: Record<string, number> = {};
  const totalImports: Record<string, number> = {};
  for (const e of edges) {
    totalExports[e.source] = (totalExports[e.source] ?? 0) + e.value;
    totalImports[e.target] = (totalImports[e.target] ?? 0) + e.value;
  }
  const totalTrade = (id: string) => (totalExports[id] ?? 0) + (totalImports[id] ?? 0);
  return { totalExports, totalImports, totalTrade };
}

/**
 * Filter and aggregate for All data NETWORK view.
 * 1. Keep top 120 flows by value
 * 2. Keep top 30 countries; aggregate rest into "Other exporters" / "Other importers"
 */
export function filterForNetwork(edges: OilTradeEdge[]): { nodes: OilTradeNode[]; edges: OilTradeEdge[] } {
  const topEdges = [...edges]
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_FLOWS_LIMIT);

  const { totalTrade } = computeTotals(topEdges);
  const allIds = [...new Set(topEdges.flatMap((e) => [e.source, e.target]))];
  const topCountries = [...allIds]
    .sort((a, b) => totalTrade(b) - totalTrade(a))
    .slice(0, TOP_COUNTRIES_NETWORK);
  const topSet = new Set(topCountries);

  const toNode = (id: string, isExporter: boolean) =>
    topSet.has(id) ? id : (isExporter ? "Other exporters" : "Other importers");

  const agg: Record<string, Record<string, number>> = {};
  for (const e of topEdges) {
    const src = toNode(e.source, true);
    const tgt = toNode(e.target, false);
    if (src === tgt) continue;
    if (!agg[src]) agg[src] = {};
    agg[src][tgt] = (agg[src][tgt] ?? 0) + e.value;
  }

  const outEdges: OilTradeEdge[] = [];
  const ids = new Set<string>();
  for (const src of Object.keys(agg)) {
    for (const tgt of Object.keys(agg[src]!)) {
      outEdges.push({ source: src, target: tgt, value: agg[src]![tgt]! });
      ids.add(src);
      ids.add(tgt);
    }
  }

  return { nodes: [...ids].sort().map((id) => ({ id })), edges: outEdges };
}

/**
 * Filter and aggregate for All data SANKEY view.
 * 1. Keep top 120 flows by value
 * 2. Keep top 15 exporters and top 15 importers; aggregate rest into "Other exporters" / "Other importers"
 */
export function filterForSankey(edges: OilTradeEdge[]): OilTradeEdge[] {
  const topEdges = [...edges]
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_FLOWS_LIMIT);

  const { totalExports, totalImports } = computeTotals(topEdges);
  const net = (id: string) => (totalExports[id] ?? 0) - (totalImports[id] ?? 0);

  const exporterIds = [...new Set(topEdges.map((e) => e.source))].filter((id) => net(id) > 0);
  const importerIds = [...new Set(topEdges.map((e) => e.target))].filter((id) => net(id) <= 0);

  const topExporters = [...exporterIds]
    .sort((a, b) => (totalExports[b] ?? 0) - (totalExports[a] ?? 0))
    .slice(0, TOP_EXPORTERS_SANKEY);
  const topImporters = [...importerIds]
    .sort((a, b) => (totalImports[b] ?? 0) - (totalImports[a] ?? 0))
    .slice(0, TOP_IMPORTERS_SANKEY);

  const topExporterSet = new Set(topExporters);
  const topImporterSet = new Set(topImporters);

  const toExporter = (id: string) => (topExporterSet.has(id) ? id : "Other exporters");
  const toImporter = (id: string) => (topImporterSet.has(id) ? id : "Other importers");

  const agg: Record<string, Record<string, number>> = {};
  for (const e of topEdges) {
    const src = toExporter(e.source);
    const tgt = toImporter(e.target);
    if (src === tgt) continue;
    if (!agg[src]) agg[src] = {};
    agg[src][tgt] = (agg[src][tgt] ?? 0) + e.value;
  }

  const outEdges: OilTradeEdge[] = [];
  for (const src of Object.keys(agg)) {
    for (const tgt of Object.keys(agg[src]!)) {
      outEdges.push({ source: src, target: tgt, value: agg[src]![tgt]! });
    }
  }

  return outEdges;
}
