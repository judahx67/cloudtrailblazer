export function focusTrail(graph, kind, id) {
  const item = (kind === "node" ? graph.nodes : graph.connections).find(item => item.id === id);
  if (!item) throw new Error("Trail item is no longer in this neighborhood");
  const connections = graph.connections.filter(edge => kind === "node"
    ? edge.source === id || edge.target === id : edge.id === id);
  const ids = new Set(connections.flatMap(edge => [edge.source, edge.target]));
  if (kind === "node") ids.add(id);
  // Keep the original identity as context for an isolated node, without inventing links.
  ids.add(graph.scope.identity_id);
  return { ...graph, nodes: graph.nodes.filter(node => ids.has(node.id)), connections,
    event_count: item.event_count, trail: { kind, id, label: kind === "node" ? item.label : item.action } };
}

export class TrailView {
  constructor({ follow, back, label, onView }) {
    this.followButton = follow; this.backButton = back; this.label = label; this.onView = onView;
    follow.addEventListener("click", () => {
      if (!this.graph || !this.candidate) return;
      this.focus = this.candidate; this.positions = new Map();
      const view = focusTrail(this.graph, this.focus.kind, this.focus.id);
      this.focus.event_count = view.event_count; this.onView(view);
      this.paint(); back.focus();
    });
    back.addEventListener("click", () => {
      if (!this.graph) return;
      this.candidate = this.focus; this.focus = null; this.onView(this.graph); this.paint(); follow.focus();
    });
    this.reset();
  }
  reset(graph = null) { this.graph = graph; this.focus = null; this.candidate = null; this.positions = new Map(); this.paint(); }
  select(kind, item) {
    if (!this.graph) return;
    this.candidate = { kind, id: item.id, label: kind === "node" ? item.label : item.action }; this.paint();
  }
  paint() {
    this.followButton.disabled = !this.candidate;
    this.backButton.hidden = !this.focus;
    this.label.textContent = this.focus ? `Trail: ${this.focus.label}: ${this.focus.event_count} supporting events`
      : this.candidate ? `${this.candidate.kind === "node" ? "Node" : "Connection"}: ${this.candidate.label}` : "";
    this.label.title = `${this.label.textContent}\n` + "Direct observed relationships in this diagram’s current scope. Node details retain neighborhood totals.";
    this.followButton.title = this.candidate ? `Follow ${this.candidate.label}` : "Select a node or connection with click or Enter/Space";
  }
}
