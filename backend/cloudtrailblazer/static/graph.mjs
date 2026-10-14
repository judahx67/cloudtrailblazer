// This first renderer handles a direct identity neighborhood, not a case overview.
export const VIEW_LIMITS = Object.freeze({ nodes: 50, connections: 80 });

export function connectionLabel(edge) {
  const relation = edge.kind === "observed_source" ? "Source observed" : "Action";
  const endpoints = edge.sourceIdentifier ? `: ${edge.sourceIdentifier} > ${edge.targetIdentifier}` : "";
  return `${relation}: ${edge.action}: ${edge.event_count} events: ${edge.outcome === "failed" ? "failed attempt" : "no error reported"}${edge.service ? `: ${edge.service}` : ""}${endpoints}`;
}

export function layoutNeighborhood(graph, positions = new Map()) {
  if (graph.nodes.length > VIEW_LIMITS.nodes || graph.connections.length > VIEW_LIMITS.connections) {
    throw new Error("View limit exceeded (50 nodes / 80 connections): narrow the time range. Grouping is not available yet.");
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
    const lane = node.kind === "ip" ? "left" : "right";
    const isFocus = node.id === focus?.id;
    return { ...node, x: isFocus ? 254 : lane === "left" ? 12 : 496,
      y: isFocus ? 80 : 80 + slot(`node:${node.id}`, lane) * 110 };
  });
  const lookup = new Map(nodes.map(node => [node.id, node]));
  const connections = [...graph.connections].sort((a, b) => a.id.localeCompare(b.id)).map(edge => {
    const source = lookup.get(edge.source), target = lookup.get(edge.target);
    if (!source || !target) throw new Error("Connection refers to a missing node");
    const incoming = edge.kind === "observed_source";
    const row = slot(`edge:${edge.id}`, incoming ? "incoming" : "outgoing");
    const label = { x: incoming ? 194 : 436, y: 110 + row * 40 };
    // A recorded self-target uses a visible loop instead of a zero-length arrow.
    const self = source.id === target.id;
    const points = self
      ? `${source.x + 122},${source.y + 29} ${label.x},${source.y + 29} ${label.x},${label.y} ${label.x},${label.y + 35} ${source.x + 61},${label.y + 35} ${source.x + 61},${source.y + 58}`
      : `${source.x + 122},${source.y + 29} ${label.x},${label.y} ${target.x},${target.y + 29}`;
    return { ...edge, label, points, number: row + 1, incoming,
      sourceIdentifier: source.identifier, targetIdentifier: target.identifier };
  });
  return { nodes, connections, width: 630,
    height: Math.max(320, ...nodes.map(node => node.y + 90), ...connections.map(edge => edge.label.y + 75)) };
}

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function interactive(group, label, activate) {
  group.setAttribute("role", "button");
  group.setAttribute("tabindex", "0");
  group.setAttribute("aria-label", label);
  group.setAttribute("aria-pressed", "false");
  group.append(svgElement("title", {}, label));
  group.addEventListener("click", activate);
  group.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
  });
}

export function renderNeighborhood(container, layout, { selectNode, selectConnection }) {
  const svg = svgElement("svg", { viewBox: `0 0 ${layout.width} ${layout.height}`,
    width: layout.width, height: layout.height, role: "group", "aria-label": "Observed identity neighborhood" });
  const marker = svgElement("marker", { id: "graph-arrow", markerWidth: 8, markerHeight: 8,
    refX: 7, refY: 4, orient: "auto", markerUnits: "userSpaceOnUse" });
  marker.append(svgElement("path", { d: "M0,0 L8,4 L0,8 Z", class: "graph-arrow" }));
  const defs = svgElement("defs"); defs.append(marker); svg.append(defs);
  for (const [x, label] of [[12, "Source IPs"], [254, "Identity"], [496, "Targets"]]) {
    svg.append(svgElement("text", { x, y: 28, class: "graph-column" }, label));
  }
  for (const edge of layout.connections) {
    const group = svgElement("g", { class: `graph-edge${edge.outcome === "failed" ? " failed" : ""}`,
      "data-connection-id": edge.id });
    group.append(svgElement("polyline", { points: edge.points, class: "graph-hit" }));
    group.append(svgElement("polyline", { points: edge.points, "marker-end": "url(#graph-arrow)" }));
    group.append(svgElement("rect", { x: edge.label.x - 18, y: edge.label.y - 14, width: 36, height: 28 }));
    group.append(svgElement("text", { x: edge.label.x, y: edge.label.y + 4, "text-anchor": "middle" },
      `${edge.incoming ? "S" : "A"}${edge.number}`));
    interactive(group, connectionLabel(edge), () => selectConnection(edge));
    svg.append(group);
  }
  for (const node of layout.nodes) {
    const group = svgElement("g", { class: "graph-node", "data-node-id": node.id });
    group.append(svgElement("rect", { x: node.x, y: node.y, width: 122, height: 58 }));
    const short = node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label;
    group.append(svgElement("text", { x: node.x + 8, y: node.y + 23 }, short));
    group.append(svgElement("text", { x: node.x + 8, y: node.y + 43, class: "graph-kind" },
      node.target_unspecified ? "target unspecified" : node.kind));
    interactive(group, `Inspect ${node.kind}: ${node.identifier}`, () => selectNode(node));
    svg.append(group);
  }
  container.replaceChildren(svg);
}
