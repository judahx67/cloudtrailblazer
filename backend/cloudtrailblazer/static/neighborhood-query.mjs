import { DETAIL_LIMITS } from "./graph.mjs";

// Group at most once. Grouped output is not subject to the raw-detail threshold.
export async function queryNeighborhood(request, rawUrl, groupedUrl) {
  let graph;
  try { graph = await request.get(rawUrl); }
  catch (error) {
    if (error.status !== 413 || error.code !== "projection_limit") throw error;
    return request.get(groupedUrl);
  }
  return graph.nodes.length > DETAIL_LIMITS.nodes || graph.connections.length > DETAIL_LIMITS.connections
    ? request.get(groupedUrl) : graph;
}
