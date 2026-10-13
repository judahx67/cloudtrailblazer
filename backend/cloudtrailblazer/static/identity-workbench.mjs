import { LatestRequest } from "./client.mjs";
import { connectionLabel, layoutNeighborhood, renderNeighborhood } from "./graph.mjs";
import { byId, element, notice, pager, disablePager } from "./ui.mjs";

const PAGE_SIZE = 20;

// Own identity navigation and graph requests; the host owns event/evidence inspection.
export class IdentityWorkbench {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.requests = { identities: new LatestRequest(), graph: new LatestRequest() };
    this.positions = new Map();
    this.identity = null;
    this.offset = 0;
    this.search = "";
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

  cancel() {
    for (const request of Object.values(this.requests)) request.cancel();
    this.ready = false;
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
    this.cancel();
    if (this.caseId !== caseId) {
      this.identity = null; this.positions.clear(); this.search = "";
      byId("identity-search").value = "";
    }
    this.caseId = caseId; this.scope = { ...scope }; this.offset = 0; this.ready = true;
    byId("identity-search").disabled = false;
    byId("identity-search-submit").disabled = false;
    notice("graph-status", this.identity ? "Loading neighborhood..." : "Choose an identity.");
    await Promise.all([this.loadIdentities(), this.identity ? this.loadGraph() : Promise.resolve()]);
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

  select(kind, item) {
    for (const node of document.querySelectorAll("#graph-canvas [role=button], #connection-list button")) {
      node.setAttribute("aria-pressed", String(kind === "node"
        ? node.dataset.nodeId === item.id : node.dataset.connectionId === item.id));
    }
    if (kind === "node") this.callbacks.selectNode(item);
    else this.callbacks.selectConnection(item, { ...this.scope, identity: this.identity.id });
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
      const graph = await this.requests.graph.get(`${this.path("/graph")}?${this.query({identity: this.identity.id})}`);
      const queried = performance.now();
      const layout = layoutNeighborhood(graph, this.positions);
      const laidOut = performance.now();
      renderNeighborhood(byId("graph-canvas"), layout, {
        selectNode: node => this.select("node", node), selectConnection: edge => this.select("connection", edge),
      });
      for (const edge of layout.connections) {
        const button = element("button", undefined, "connection-choice");
        button.dataset.connectionId = edge.id; button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", connectionLabel(edge));
        button.textContent = `${edge.incoming ? "S" : "A"}${edge.number}: ${edge.action}: ${edge.event_count}${edge.outcome === "failed" ? ": failed" : ": no error"}`;
        button.title = `${edge.service}\n${connectionLabel(edge)}`;
        if (edge.outcome === "failed") button.classList.add("warning");
        button.addEventListener("click", () => this.select("connection", edge));
        byId("connection-list").append(button);
      }
      byId("graph-count").textContent = `${graph.event_count} events: ${graph.nodes.length} nodes: ${graph.connections.length} links`;
      const finished = performance.now();
      byId("graph-count").title = "Unique events: one event may support several links.";
      byId("graph-count").dataset.timings = JSON.stringify({ queryMs: queried-start,
        layoutMs: laidOut-queried, domMs: finished-laidOut });
      notice("graph-status", graph.nodes.length ? "" : "No activity for this identity in the applied time range.");
    } catch (error) {
      if (error.name !== "AbortError") notice("graph-status", error.message, true);
    }
  }
}
