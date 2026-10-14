import { LatestRequest } from "./client.mjs";
import { connectionLabel, layoutNeighborhood, renderNeighborhood, VIEW_LIMITS } from "./graph.mjs";
import { byId, element, notice, pager, disablePager } from "./ui.mjs";
import { SubgraphWindow } from "./subgraph-window.mjs";

const PAGE_SIZE = 20;

// Own identity navigation and graph requests; the host owns event/evidence inspection.
export class IdentityWorkbench {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.requests = { identities: new LatestRequest(), graph: new LatestRequest(), group: new LatestRequest() };
    this.positions = new Map();
    this.identity = null;
    this.offset = 0;
    this.search = "";
    this.window = new SubgraphWindow(() => this.closeGroup());
    this.groupPositions = new Map(); this.group = null; this.memberOffset = 0; this.memberSearch = "";
    byId("open-group").addEventListener("click", () => this.openGroup(this.selectedGroup));
    byId("subgraph-search-form").addEventListener("submit", event => {
      event.preventDefault(); this.memberSearch = byId("subgraph-search").value.trim();
      this.memberOffset = 0; this.groupPositions.clear(); this.loadGroup();
    });
    for (const [suffix, step] of [["prev", -1], ["next", 1]]) {
      byId(`members-${suffix}`).addEventListener("click", () => {
        this.memberOffset = Math.max(0, this.memberOffset + step * PAGE_SIZE);
        this.groupPositions.clear(); this.loadGroup();
      });
    }
    byId("identity-search-form").addEventListener("submit", event => {
      event.preventDefault(); this.search = byId("identity-search").value.trim();
      this.offset = 0; this.loadIdentities();
    });
    for (const [suffix, step] of [["prev", -1], ["next", 1]]) {
      byId(`identities-${suffix}`).addEventListener("click", () => {
        this.offset = Math.max(0, this.offset + step * PAGE_SIZE); this.loadIdentities();
      });
    }
  }

  cancel({ preserveGroup = false } = {}) {
    for (const request of Object.values(this.requests)) request.cancel();
    this.ready = false;
    if (preserveGroup && this.group) this.clearGroupView("Checking applied scope...");
    else this.closeGroup(false);
    byId("identity-search").disabled = true;
    byId("identity-search-submit").disabled = true;
    disablePager("identities");
    byId("identity-list").replaceChildren();
    byId("identities-page").textContent = "";
    byId("graph-canvas").replaceChildren();
    byId("connection-list").replaceChildren();
    byId("graph-count").textContent = "";
    delete byId("graph-count").dataset.timings;
    notice("graph-status", "Apply a valid time range to browse identities.");
    this.callbacks.clearConnection();
  }

  async open(caseId, scope) {
    this.cancel({ preserveGroup: this.caseId === caseId });
    if (this.caseId !== caseId) {
      this.identity = null; this.positions.clear(); this.search = "";
      byId("identity-search").value = "";
    }
    this.caseId = caseId; this.scope = { ...scope }; this.offset = 0; this.memberOffset = 0; this.ready = true;
    byId("identity-search").disabled = false;
    byId("identity-search-submit").disabled = false;
    notice("graph-status", this.identity ? "Loading neighborhood..." : "Choose an identity.");
    await Promise.all([this.loadIdentities(), this.identity ? this.loadGraph() : Promise.resolve(),
      this.group ? this.loadGroup(true) : Promise.resolve()]);
  }

  query(extra = {}) {
    return new URLSearchParams({ ...Object.fromEntries(Object.entries(this.scope).filter(([, value]) => value)), ...extra });
  }

  path(suffix) { return `/api/cases/${encodeURIComponent(this.caseId)}${suffix}`; }

  async loadIdentities() {
    if (!this.ready) return;
    disablePager("identities");
    byId("identity-list").replaceChildren();
    notice("identity-status", "Loading identities...");
    try {
      const data = await this.requests.identities.get(`${this.path("/identities")}?${this.query({
        search: this.search, limit: PAGE_SIZE, offset: this.offset })}`);
      for (const node of data.items) {
        const button = element("button", undefined, "identity-choice");
        button.dataset.identityId = node.id;
        button.setAttribute("aria-label", `Focus ${node.label}: ${node.event_count} events: ${node.account_id || "account unknown"}`);
        button.setAttribute("aria-pressed", String(node.id === this.identity?.id));
        button.title = `${node.identifier}\nFirst: ${node.first_seen}\nLast: ${node.last_seen}`;
        const label = element("span", node.label);
        const detail = element("span", `${node.account_id || "account unknown"}: ${node.event_count} events`, "muted");
        button.append(label, detail);
        button.addEventListener("click", () => {
          this.closeGroup(false);
          this.identity = node; this.positions.clear(); this.loadGraph();
          for (const item of byId("identity-list").children) {
            item.setAttribute("aria-pressed", String(item.dataset.identityId === node.id));
          }
          this.callbacks.selectNode(node);
        });
        byId("identity-list").append(button);
      }
      notice("identity-status", data.total ? "" : "No identities in this search and time range.");
      pager("identities", this.offset, data.items.length, data.total, PAGE_SIZE, "identities");
    } catch (error) {
      if (error.name !== "AbortError") notice("identity-status", error.message, true);
    }
  }

  select(kind, item, origin = "main") {
    this.selectionOrigin = origin;
    this.selectedGroup = kind === "node" && item.kind === "group" ? item : null;
    for (const node of document.querySelectorAll("#graph-canvas [role=button], #connection-list button, #subgraph-canvas [role=button], #subgraph-connections button, #subgraph-members button")) {
      node.setAttribute("aria-pressed", String(kind === "node"
        ? node.dataset.nodeId === item.id : node.dataset.connectionId === item.id));
    }
    const context = origin === "group" ? this.group.identifier : null;
    if (kind === "node") this.callbacks.selectNode(item, context);
    else this.callbacks.selectConnection(item, { ...this.scope, identity: this.identity.id,
      ...(origin === "group" ? { group: this.group.id } : {}) }, context);
  }

  draw(graph, origin = "main") {
    const child = origin === "group";
    const layout = layoutNeighborhood(graph, child ? this.groupPositions : this.positions);
    renderNeighborhood(byId(child ? "subgraph-canvas" : "graph-canvas"), layout, {
      selectNode: node => this.select("node", node, origin),
      selectConnection: edge => this.select("connection", edge, origin),
    });
    const list = byId(child ? "subgraph-connections" : "connection-list");
    list.replaceChildren();
    for (const edge of layout.connections) {
      const button = element("button", undefined, "connection-choice");
      button.dataset.connectionId = edge.id; button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", connectionLabel(edge));
      button.textContent = `${edge.incoming ? "S" : "A"}${edge.number}: ${edge.action}: ${edge.event_count}${edge.outcome === "failed" ? ": failed" : ": no error"}`;
      button.title = `${edge.service}\n${connectionLabel(edge)}`;
      if (edge.outcome === "failed") button.classList.add("warning");
      button.addEventListener("click", () => this.select("connection", edge, origin));
      list.append(button);
    }
    return layout;
  }

  clearGroupView(message) {
    disablePager("members");
    for (const id of ["subgraph-search", "subgraph-search-submit"]) byId(id).disabled = true;
    for (const id of ["subgraph-members", "subgraph-canvas", "subgraph-connections"]) byId(id).replaceChildren();
    byId("subgraph-count").textContent = ""; byId("members-page").textContent = "";
    notice("subgraph-status", message);
  }

  invalidateScope() {
    notice("graph-status", "Scope unavailable.");
    if (this.group) this.clearGroupView("Scope unavailable: graph not refreshed.");
  }

  openGroup(group) {
    if (!this.ready || !group) return;
    this.group = group; this.memberSearch = ""; this.memberOffset = 0; this.groupPositions.clear();
    this.focusGroupSearch = true;
    byId("subgraph-search").value = "";
    this.window.show(`${this.identity.label} > ${group.identifier}`);
    this.loadGroup();
  }

  closeGroup(restoreFocus = true) {
    const group = this.group;
    this.requests.group.cancel(); this.window.hide(); this.group = null;
    if (this.selectionOrigin === "group") this.callbacks.resetInspection();
    this.selectionOrigin = null;
    if (restoreFocus && group && this.ready) {
      const parent = document.querySelector(`#graph-canvas [data-node-id="${group.id}"]`);
      if (parent) { this.selectedGroup = group; this.callbacks.selectNode(group); parent.focus(); }
      else { this.callbacks.resetInspection(); byId("identity-search").focus(); }
    }
  }

  async loadGroup(preserveEvidence = false) {
    if (!this.ready || !this.group) return;
    if (!preserveEvidence) this.callbacks.resetInspection();
    this.clearGroupView("Loading group...");
    const group = this.group;
    try {
      const data = await this.requests.group.get(`${this.path(`/groups/${encodeURIComponent(group.id)}`)}?${this.query({
        identity: this.identity.id, search: this.memberSearch, limit: PAGE_SIZE, offset: this.memberOffset })}`);
      this.group = data.group;
      byId("subgraph-count").textContent = `${data.member_count} members: ${data.group.event_count} events`;
      const nodes = new Map(data.graph.nodes.map(node => [node.id, node]));
      for (const id of data.member_ids) {
        const node = nodes.get(id);
        const button = element("button", node.label, "identity-choice");
        button.dataset.nodeId = node.id; button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `Inspect member: ${node.identifier}`);
        button.title = node.identifier;
        button.addEventListener("click", () => this.select("node", node, "group"));
        byId("subgraph-members").append(button);
      }
      pager("members", this.memberOffset, data.member_ids.length,
        data.total, PAGE_SIZE, "members");
      if (data.total) {
        try { this.draw(data.graph, "group"); notice("subgraph-status", ""); }
        catch (error) { notice("subgraph-status", error.message, true); }
      } else notice("subgraph-status", "No members match this search.");
    } catch (error) {
      if (error.name === "AbortError") return;
      notice("subgraph-status", error.status === 404
        ? "Group unavailable in the applied range." : error.message, true);
    }
    if (this.ready && this.group && this.requests.group.active) {
      for (const id of ["subgraph-search", "subgraph-search-submit"]) byId(id).disabled = false;
      if (this.focusGroupSearch) { byId("subgraph-search").focus(); this.focusGroupSearch = false; }
    }
  }

  async loadGraph() {
    if (!this.ready || !this.identity) return;
    this.callbacks.clearConnection();
    byId("graph-canvas").replaceChildren(); byId("connection-list").replaceChildren();
    byId("graph-count").textContent = "";
    delete byId("graph-count").dataset.timings;
    notice("graph-status", "Loading neighborhood...");
    const start = performance.now();
    try {
      const query = this.query({identity: this.identity.id});
      let graph;
      try { graph = await this.requests.graph.get(`${this.path("/graph")}?${query}`); }
      catch (error) {
        if (error.status !== 413 || error.code !== "projection_limit") throw error;
        graph = await this.requests.graph.get(`${this.path("/grouped-graph")}?${query}`);
      }
      if (graph.nodes.length > VIEW_LIMITS.nodes || graph.connections.length > VIEW_LIMITS.connections) {
        graph = await this.requests.graph.get(`${this.path("/grouped-graph")}?${query}`);
      }
      const queried = performance.now();
      this.draw(graph);
      const laidOut = performance.now();
      byId("graph-count").textContent = `${graph.event_count} events: ${graph.nodes.length} nodes: ${graph.connections.length} links`;
      const finished = performance.now();
      byId("graph-count").title = "Unique events: one event may support several links.";
      byId("graph-count").dataset.timings = JSON.stringify({ queryMs: queried-start,
        layoutAndDomMs: laidOut-queried, summaryMs: finished-laidOut });
      notice("graph-status", graph.nodes.length ? "" : "No activity for this identity in the applied time range.");
    } catch (error) {
      if (error.name !== "AbortError") notice("graph-status", error.message, true);
    }
  }
}
