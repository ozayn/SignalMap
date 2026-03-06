import { toDisplayName } from "@/lib/oil-trade-regions";

export type OilTradeEdge = { source: string; target: string; value: number };
export type OilTradeNode = { id: string };

const TOP_FLOWS_LIMIT = 120;

/** Normalize country names and aggregate duplicate edges (USA + United States → United States). */
function normalizeEdges(edges: OilTradeEdge[]): OilTradeEdge[] {
  const agg: Record<string, Record<string, number>> = {};
  for (const e of edges) {
    const src = toDisplayName(e.source);
    const tgt = toDisplayName(e.target);
    if (!agg[src]) agg[src] = {};
    agg[src][tgt] = (agg[src][tgt] ?? 0) + e.value;
  }
  const out: OilTradeEdge[] = [];
  for (const src of Object.keys(agg)) {
    for (const tgt of Object.keys(agg[src]!)) {
      out.push({ source: src, target: tgt, value: agg[src]![tgt]! });
    }
  }
  return out;
}
const TOP_COUNTRIES_NETWORK = 30;
const TOP_EXPORTERS_SANKEY = 15;
const TOP_IMPORTERS_SANKEY = 15;

/** Always show these countries even if below top-N by volume. */
const PRIORITY_COUNTRIES = new Set(["Iran"]);

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
  const normalized = normalizeEdges(edges);
  const sorted = [...normalized].filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const topEdges = sorted.slice(0, TOP_FLOWS_LIMIT);
  const topKeys = new Set(topEdges.map((e) => `${e.source}|${e.target}`));
  const priorityEdges = sorted.filter(
    (e) =>
      !topKeys.has(`${e.source}|${e.target}`) &&
      (PRIORITY_COUNTRIES.has(e.source) || PRIORITY_COUNTRIES.has(e.target))
  );
  const edgesWithPriority = [...topEdges, ...priorityEdges.slice(0, 20)];

  const { totalTrade } = computeTotals(edgesWithPriority);
  const allIds = [...new Set(edgesWithPriority.flatMap((e) => [e.source, e.target]))];
  const priorityInData = allIds.filter((id) => PRIORITY_COUNTRIES.has(id));
  const restByTrade = [...allIds]
    .filter((id) => !PRIORITY_COUNTRIES.has(id))
    .sort((a, b) => totalTrade(b) - totalTrade(a))
    .slice(0, TOP_COUNTRIES_NETWORK - priorityInData.length);
  const topCountries = [...priorityInData, ...restByTrade];
  const topSet = new Set(topCountries);

  const toNode = (id: string, isExporter: boolean) =>
    topSet.has(id) ? id : (isExporter ? "Other exporters" : "Other importers");

  const agg: Record<string, Record<string, number>> = {};
  for (const e of edgesWithPriority) {
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
  const normalized = normalizeEdges(edges);
  const sorted = [...normalized].filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const topEdges = sorted.slice(0, TOP_FLOWS_LIMIT);
  const topKeys = new Set(topEdges.map((e) => `${e.source}|${e.target}`));
  const priorityEdges = sorted.filter(
    (e) =>
      !topKeys.has(`${e.source}|${e.target}`) &&
      (PRIORITY_COUNTRIES.has(e.source) || PRIORITY_COUNTRIES.has(e.target))
  );
  const edgesWithPriority = [...topEdges, ...priorityEdges.slice(0, 20)];

  const { totalExports, totalImports } = computeTotals(edgesWithPriority);
  const net = (id: string) => (totalExports[id] ?? 0) - (totalImports[id] ?? 0);

  const exporterIds = [...new Set(edgesWithPriority.map((e) => e.source))].filter((id) => net(id) > 0);
  const importerIds = [...new Set(edgesWithPriority.map((e) => e.target))].filter((id) => net(id) <= 0);

  const priorityExporters = exporterIds.filter((id) => PRIORITY_COUNTRIES.has(id));
  const restExporters = [...exporterIds]
    .filter((id) => !PRIORITY_COUNTRIES.has(id))
    .sort((a, b) => (totalExports[b] ?? 0) - (totalExports[a] ?? 0))
    .slice(0, TOP_EXPORTERS_SANKEY - priorityExporters.length);
  const topExporters = [...priorityExporters, ...restExporters];
  const priorityImporters = importerIds.filter((id) => PRIORITY_COUNTRIES.has(id));
  const restImporters = [...importerIds]
    .filter((id) => !PRIORITY_COUNTRIES.has(id))
    .sort((a, b) => (totalImports[b] ?? 0) - (totalImports[a] ?? 0))
    .slice(0, TOP_IMPORTERS_SANKEY - priorityImporters.length);
  const topImporters = [...priorityImporters, ...restImporters];

  const topExporterSet = new Set(topExporters);
  const topImporterSet = new Set(topImporters);

  const toExporter = (id: string) => (topExporterSet.has(id) ? id : "Other exporters");
  const toImporter = (id: string) => (topImporterSet.has(id) ? id : "Other importers");

  const agg: Record<string, Record<string, number>> = {};
  for (const e of edgesWithPriority) {
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
