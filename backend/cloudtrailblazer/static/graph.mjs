import { ColumnLayout } from "./graph-columns.mjs";
// This first renderer handles a direct identity neighborhood, not a case overview.
// Small raw views stay detailed; these are grouping thresholds, not rejection limits.
export const DETAIL_LIMITS = Object.freeze({ nodes: 50, connections: 80 });
// Match the existing server output ceiling. A returned grouped view remains complete.
export const VIEW_LIMITS = Object.freeze({ nodes: 500, connections: 1500 });

export function connectionLabel(edge) {
  const relation = edge.kind === "observed_source" ? "Source observed" : "Action";
  const endpoints = edge.sourceIdentifier ? `: ${edge.sourceIdentifier} > ${edge.targetIdentifier}` : "";
  return `${relation}: ${edge.action}: ${edge.event_count} events: ${edge.outcome === "failed" ? "failed attempt" : "no error reported"}${edge.service ? `: ${edge.service}` : ""}${endpoints}`;
}

export function layoutNeighborhood(graph, positions = new Map(), columns = new ColumnLayout()) {
  if (graph.nodes.length > VIEW_LIMITS.nodes || graph.connections.length > VIEW_LIMITS.connections) {
    throw new Error("Render limit exceeded (500 nodes / 1500 connections): refine the identity or group member search.");
  }
  const focus = graph.nodes.find(node => node.id === graph.scope.identity_id);
  if (!focus && graph.nodes.length) throw new Error("Selected identity is missing from this neighborhood");
  const rows = { left: 0, right: 0, incoming: 0, outgoing: 0 };
  for (const value of positions.values()) rows[value.lane] = Math.max(rows[value.lane], value.row + 1);
  const slot = (id, lane) => {
    if (!positions.has(id)) positions.set(id, { lane, row: rows[lane]++ });
    return positions.get(id).row;
  };
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(node => {
    const lane = node.kind === "ip" || node.group_type === "source" ? "left" : "right";
    const isFocus = node.id === focus?.id;
    const column = columns.columns[isFocus ? 1 : lane === "left" ? 0 : 2];
    return { ...node, x: column.x, width: column.width,
      y: isFocus ? 80 : 80 + slot(`node:${node.id}`, lane) * 110 };
  });
  const lookup = new Map(nodes.map(node => [node.id, node]));
  const connections = [...graph.connections].sort((a, b) => a.id.localeCompare(b.id)).map(edge => {
    const source = lookup.get(edge.source), target = lookup.get(edge.target);
    if (!source || !target) throw new Error("Connection refers to a missing node");
    const incoming = edge.kind === "observed_source";
    const row = slot(`edge:${edge.id}`, incoming ? "incoming" : "outgoing");
    const left = columns.columns[incoming ? 0 : 1], right = columns.columns[incoming ? 1 : 2];
    const label = { x: (left.x + left.width + right.x) / 2, y: 110 + row * 40 };
    // A recorded self-target uses a visible loop instead of a zero-length arrow.
    const self = source.id === target.id;
    const points = self
      ? `${source.x + source.width},${source.y + 29} ${label.x},${source.y + 29} ${label.x},${label.y} ${label.x},${label.y + 35} ${source.x + source.width / 2},${label.y + 35} ${source.x + source.width / 2},${source.y + 58}`
      : `${source.x + source.width},${source.y + 29} ${label.x},${label.y} ${target.x},${target.y + 29}`;
    return { ...edge, label, points, number: row + 1, incoming,
      sourceIdentifier: source.identifier, targetIdentifier: target.identifier };
  });
  return { nodes, connections, width: columns.width,
    height: Math.max(320, ...nodes.map(node => node.y + 90), ...connections.map(edge => edge.label.y + 75)) };
}

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function interactive(group, label, activate, preview) {
  group.setAttribute("role", "button");
  group.setAttribute("tabindex", "0");
  group.setAttribute("aria-label", label);
  group.setAttribute("aria-pressed", "false");
  group.append(svgElement("title", {}, label));
  group.addEventListener("click", activate);
  group.addEventListener("mouseenter", preview);
  group.addEventListener("focus", preview);
  group.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
  });
}

export function renderNeighborhood(container, layout, { selectNode, selectConnection, preview = () => {} }) {
  const markerId = `${container.id}-arrow`;
  const svg = svgElement("svg", { viewBox: `0 0 ${layout.width} ${layout.height}`,
    width: layout.width, height: layout.height, role: "group", "aria-label": "Observed identity neighborhood" });
  const marker = svgElement("marker", { id: markerId, markerWidth: 8, markerHeight: 8,
    refX: 7, refY: 4, orient: "auto", markerUnits: "userSpaceOnUse" });
  marker.append(svgElement("path", { d: "M0,0 L8,4 L0,8 Z", class: "graph-arrow" }));
  const defs = svgElement("defs"); defs.append(marker); svg.append(defs);
  for (const edge of layout.connections) {
    const group = svgElement("g", { class: `graph-edge${edge.outcome === "failed" ? " failed" : ""}`,
      "data-connection-id": edge.id });
    group.append(svgElement("polyline", { points: edge.points, class: "graph-hit" }));
    group.append(svgElement("polyline", { points: edge.points, "marker-end": `url(#${markerId})` }));
    group.append(svgElement("rect", { x: edge.label.x - 18, y: edge.label.y - 14, width: 36, height: 28 }));
    group.append(svgElement("text", { x: edge.label.x, y: edge.label.y + 4, "text-anchor": "middle" },
      `${edge.incoming ? "S" : "A"}${edge.number}`));
    interactive(group, connectionLabel(edge), () => selectConnection(edge), () => preview("connection", edge));
    svg.append(group);
  }
  for (const node of layout.nodes) {
    const group = svgElement("g", { class: "graph-node", "data-node-id": node.id });
    group.append(svgElement("rect", { x: node.x, y: node.y, width: node.width, height: 58 }));
    const characters = Math.max(16, Math.floor((node.width - 16) / 7));
    const short = node.label.length > characters ? `${node.label.slice(0, characters - 1)}…` : node.label;
    group.append(svgElement("text", { x: node.x + 8, y: node.y + 23 }, short));
    group.append(svgElement("text", { x: node.x + 8, y: node.y + 43, class: "graph-kind" },
      node.target_unspecified ? "target unspecified" : node.kind === "group" ? `${node.member_kind} group` : node.kind));
    interactive(group, `Inspect ${node.kind}: ${node.identifier}`, () => selectNode(node), () => preview("node", node));
    svg.append(group);
  }
  const previous = container.querySelector("svg");
  if (previous) previous.replaceWith(svg); else container.append(svg);
}
