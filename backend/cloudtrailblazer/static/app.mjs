import { LatestRequest, evidenceInScope } from "./client.mjs";
import { IdentityWorkbench } from "./identity-workbench.mjs";
import { TimeSlider } from "./time-slider.mjs";
import { PanelLayout } from "./panel-layout.mjs";
import { byId, element, notice, pager, disablePager, renderDetails } from "./ui.mjs";

const requests = Object.fromEntries(["cases", "summary", "events", "evidence", "connection"].map(
  (name) => [name, new LatestRequest()]));
const state = {
  caseId: null, summary: null, caseOffset: 0, eventOffset: 0,
  selected: null, evidence: null, sourceOffset: 0, scope: null, scopePending: false, bounds: {},
  view: "identity", connection: null,
};
const CASE_PAGE = 25;
const EVENT_PAGE = 50;
const SOURCE_PAGE = 20;

function errorNotice(id, error) {
  if (error.name !== "AbortError") notice(id, error.message, true);
}

function casePath(suffix = "") {
  return `/api/cases/${encodeURIComponent(state.caseId)}${suffix}`;
}

function timeControls(enabled) {
  timeSlider.setEnabled(enabled);
  for (const id of ["time-start", "time-end", "apply-time", "reset-time"]) {
    byId(id).disabled = !enabled;
  }
}

function markSelection() {
  for (const row of byId("event-rows").children) {
    const selected = row.dataset.key === state.selected?.event_key;
    row.setAttribute("aria-selected", String(selected));
    row.querySelector("button").setAttribute("aria-pressed", String(selected));
  }
}

function staleNotice(text = "") {
  byId("stale-evidence").textContent = text;
  byId("stale-evidence").hidden = !text;
}

function checkSelectionScope() {
  if (state.selected && !state.scope) {
    staleNotice(state.scopePending ? "Checking selection against time range..."
      : "Scope unavailable: selection not verified");
    return;
  }
  staleNotice(state.selected && state.scope &&
    !evidenceInScope(state.selected.event_time, state.scope)
    ? "Outside applied time range" : "");
}

function clearEvidence() {
  requests.evidence.cancel();
  state.selected = null;
  state.evidence = null;
  state.sourceOffset = 0;
  byId("evidence-content").hidden = true;
  setCodeCopyEnabled(false);
  byId("raw-json").textContent = "";
  notice("evidence-status", "Select an event.");
  staleNotice();
}

async function loadCases() {
  disablePager("cases");
  byId("refresh-cases").disabled = true;
  notice("case-status", "Loading cases...");
  byId("case-list").replaceChildren();
  try {
    const data = await requests.cases.get(`/api/cases?limit=${CASE_PAGE}&offset=${state.caseOffset}`);
    // A refresh can shrink the catalog. Return to its first page rather than strand the user.
    if (!data.items.length && state.caseOffset && data.total) {
      state.caseOffset = 0;
      return loadCases();
    }
    for (const item of data.items) {
      const button = element("button", undefined, "case-choice");
      button.dataset.caseId = item.case_id;
      button.setAttribute("aria-pressed", String(item.case_id === state.caseId));
      button.setAttribute("aria-label", `${item.name}: ${item.event_count} events`);
      button.title = `${item.name}\nImported: ${item.created_at}`;
      button.append(element("span", item.name), element("span", item.event_count, "muted"));
      button.addEventListener("click", () => selectCase(item));
      byId("case-list").append(button);
    }
    notice("case-status", data.unavailable_count
      ? `${data.unavailable_count} unavailable cases` : data.total ? "" : "No cases. Import logs with the CLI.");
    pager("cases", state.caseOffset, data.items.length, data.total, CASE_PAGE, "cases");
    byId("refresh-cases").disabled = false;
  } catch (error) {
    errorNotice("case-status", error);
    if (error.name !== "AbortError") byId("refresh-cases").disabled = false;
  }
}

async function selectCase(item) {
  for (const name of ["summary", "events", "evidence", "connection"]) requests[name].cancel();
  identityWorkbench.cancel();
  state.caseId = item.case_id;
  state.summary = null;
  state.scope = null;
  state.bounds = {};
  state.scopePending = false;
  state.eventOffset = 0;
  clearEvidence();
  timeControls(false);
  for (const id of ["view-identity", "view-events"]) byId(id).disabled = true;
  disablePager("events");
  byId("event-rows").replaceChildren();
  byId("event-region").setAttribute("aria-busy", "true");
  byId("case-name").textContent = item.name;
  byId("case-name").title = item.name;
  byId("case-count").textContent = `${item.event_count} events`;
  byId("events-page").textContent = "";
  byId("time-start").value = "";
  byId("time-end").value = "";
  byId("time-draft").textContent = "";
  byId("workspace-status").textContent = "Read only";
  notice("events-status", "Opening case...");
  for (const button of byId("case-list").children) {
    button.setAttribute("aria-pressed", String(button.dataset.caseId === state.caseId));
  }
  try {
    state.summary = await requests.summary.get(casePath());
    byId("time-start").value = state.summary.time_range.start || "";
    byId("time-end").value = state.summary.time_range.end || "";
    state.bounds = { ...state.summary.time_range };
    byId("case-count").title = `${state.summary.source_count} sources: ${state.summary.duplicate_count} duplicate occurrences`;
    timeSlider.configure(state.summary.time_range);
    timeControls(true);
    for (const id of ["view-identity", "view-events"]) byId(id).disabled = false;
    await loadEvents();
  } catch (error) {
    errorNotice("events-status", error);
    if (error.name !== "AbortError") byId("event-region").setAttribute("aria-busy", "false");
  }
}

async function loadEvents() {
  if (state.view === "identity") identityWorkbench.cancel({ preserveGroup: true });
  disablePager("events");
  notice("events-status", state.view === "identity" ? "Checking time range..." : "Loading events...");
  byId("event-region").setAttribute("aria-busy", "true");
  byId("event-rows").replaceChildren();
  byId("events-page").textContent = "";
  state.scope = null;
  state.scopePending = true;
  if (state.selected) staleNotice("Checking selection against time range...");
  const query = new URLSearchParams({ limit: EVENT_PAGE, offset: state.eventOffset });
  for (const bound of ["start", "end"]) {
    const value = state.bounds[bound];
    if (value) query.set(bound, value);
  }
  try {
    const data = await requests.events.get(`${casePath("/events")}?${query}`);
    state.scope = data.scope;
    state.scopePending = false;
    renderEventRows(data.items);
    checkSelectionScope();
    notice("events-status", data.total ? "" : "No activity in this time range.");
    pager("events", state.eventOffset, data.items.length, data.total, EVENT_PAGE, "events");
    byId("event-region").setAttribute("aria-busy", "false");
    byId("workspace-status").textContent = `Read only: ${data.total} case events in range`;
    if (state.view === "identity") await identityWorkbench.open(state.caseId, state.scope);
  } catch (error) {
    if (error.name !== "AbortError") {
      errorNotice("events-status", error);
      state.scopePending = false;
      if (state.view === "identity") identityWorkbench.invalidateScope();
      byId("event-region").setAttribute("aria-busy", "false");
      if (state.selected) staleNotice("Scope unavailable: selection not verified");
      byId("workspace-status").textContent = "Time query failed";
    }
  }
}

function renderEventRows(items) {
  byId("event-rows").replaceChildren();
  for (const item of items) {
    const row = element("tr");
    row.dataset.key = item.event_key;
    const time = element("td", item.event_time.replace("+00:00", "Z"));
    time.title = item.event_time;
    row.append(time);
    const action = element("button", item.event_name, "event-action");
    action.title = item.event_source;
    action.setAttribute("aria-label", `Inspect ${item.event_name} at ${item.event_time}`);
    action.addEventListener("click", () => selectEvent(item));
    const actionCell = element("td");
    actionCell.append(action);
    const actor = element("td", item.actor_arn || item.account_id || "See JSON", "actor");
    actor.title = item.actor_arn || item.account_id || "Actor not recorded in summary; inspect JSON";
    const outcome = element("td", item.outcome === "failed" ? "failed" : "no error", "outcome");
    if (item.outcome === "failed") outcome.classList.add("warning");
    outcome.title = item.outcome === "failed" ? "Recorded error: inspect original JSON"
      : "No error reported; does not prove a resource mutation";
    row.append(actionCell, actor, outcome);
    byId("event-rows").append(row);
  }
  markSelection();
}

function clearConnection() {
  requests.connection.cancel();
  if (state.connection) notice("events-status", "");
  state.connection = null;
  byId("event-region").setAttribute("aria-busy", "false");
  byId("graph-details").hidden = true;
  byId("open-group").hidden = true;
  byId("connection-heading").hidden = true;
  if (state.view === "identity") byId("event-section").hidden = true;
}

function graphDetails(title, fields, note = "") {
  clearEvidence(); markSelection();
  notice("evidence-status", "");
  byId("graph-detail-title").textContent = title;
  renderDetails("graph-detail-fields", fields);
  byId("graph-detail-note").textContent = note;
  byId("graph-details").hidden = false;
}

function selectNode(node, context = null) {
  clearConnection();
  graphDetails(node.label, [["Context", context ? `Subgraph: ${context}` : "Identity focus"],
    ["Type", node.kind], ["Locator", node.identifier],
    ["Account", node.account_id], ["Events", node.event_count], ["First", node.first_seen],
    ["Last", node.last_seen], ...(node.kind === "group"
      ? [["Members", node.member_count], ["Service", node.service], ["Region", node.region]]
      : [["Sessions", node.session_count], ["Unresolved", node.unresolved_session_event_count]])], node.target_unspecified
    ? "Target unspecified: the event records a service, not an explicit resource."
    : node.kind === "ip" ? "Observed source only: a shared IP does not establish shared identity." : "");
  byId("open-group").hidden = node.kind !== "group";
}

function selectConnection(edge, scope, context = null) {
  graphDetails(edge.action, [["Context", context ? `Subgraph: ${context}` : "Identity focus"],
    ["Relation", edge.kind === "action" ? "Action" : "Observed source"],
    ["From", edge.sourceIdentifier], ["To", edge.targetIdentifier],
    ["Service", edge.service], ["Outcome", edge.outcome === "failed" ? "Failed attempt" : "No error reported"],
    ["Events", edge.event_count], ["First", edge.first_seen], ["Last", edge.last_seen],
    ...(edge.grouped ? [["Actions", edge.action_count], ["Links", edge.member_connection_count]] : [])],
  edge.outcome === "failed" ? "Failed calls remain attempts." : "No reported error does not prove a resource mutation.");
  state.connection = { edge, scope };
  state.eventOffset = 0;
  byId("event-section").hidden = false;
  byId("connection-heading").hidden = false;
  byId("connection-name").textContent = `${edge.action}: ${edge.event_count}`;
  loadSupportingEvents();
}

async function loadSupportingEvents() {
  if (!state.connection) return;
  disablePager("events");
  renderEventRows([]);
  byId("events-page").textContent = "";
  byId("event-region").setAttribute("aria-busy", "true");
  notice("events-status", "Loading supporting events...");
  const { edge, scope } = state.connection;
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(scope).filter(([, value]) => value)),
    limit: EVENT_PAGE, offset: state.eventOffset });
  try {
    const collection = edge.grouped ? "grouped-connections" : "connections";
    const data = await requests.connection.get(`${casePath(`/${collection}/${encodeURIComponent(edge.id)}/events`)}?${query}`);
    renderEventRows(data.items);
    pager("events", state.eventOffset, data.items.length, data.total, EVENT_PAGE, "events");
    notice("events-status", data.total ? "" : "No supporting events in this scope.");
    byId("event-region").setAttribute("aria-busy", "false");
  } catch (error) {
    if (error.name !== "AbortError") {
      errorNotice("events-status", error);
      byId("event-region").setAttribute("aria-busy", "false");
    }
  }
}

for (const view of ["identity", "events"]) {
  byId(`view-${view}`).addEventListener("click", () => {
    if (state.view === view) return;
    state.view = view;
    requests.events.cancel();
    identityWorkbench.cancel();
    clearEvidence();
    state.eventOffset = 0;
    for (const mode of ["identity", "events"]) byId(`view-${mode}`).setAttribute("aria-pressed", String(mode === view));
    byId("graph-workspace").hidden = view !== "identity";
    byId("event-section").hidden = view !== "events";
    byId("view-path").textContent = `local > ${view}`;
    loadEvents();
  });
}

async function selectEvent(item) {
  state.selected = item;
  state.sourceOffset = 0;
  state.evidence = null;
  byId("evidence-content").hidden = true;
  setCodeCopyEnabled(false);
  byId("raw-json").textContent = "";
  markSelection();
  checkSelectionScope();
  await loadEvidence();
}

async function loadEvidence() {
  disablePager("sources");
  const initial = !state.evidence;
  const statusId = initial ? "evidence-status" : "sources-status";
  byId("sources-status").hidden = initial;
  notice(statusId, initial ? "Loading evidence..." : "Loading sources...");
  const query = new URLSearchParams({ limit: SOURCE_PAGE, offset: state.sourceOffset });
  try {
    const data = await requests.evidence.get(
      `${casePath(`/events/${encodeURIComponent(state.selected.event_key)}`)}?${query}`);
    state.evidence = data;
    const fields = [
      ["Action", state.selected.event_name], ["Time", state.selected.event_time],
      ["Service", state.selected.event_source], ["Actor", state.selected.actor_arn || "Not in summary"],
      ["Outcome", state.selected.outcome], ["Key", data.event_key],
    ];
    renderDetails("event-details", fields);
    byId("raw-json").textContent = data.event_json;
    byId("source-count").textContent = `${data.occurrence_count} ${data.occurrence_count === 1 ? "occurrence" : "occurrences"}`;
    byId("source-list").replaceChildren();
    for (const occurrence of data.occurrences) {
      const source = occurrence.source;
      const details = element("details");
      const name = source.original_path.split(/[/\\]/).pop();
      const summary = element("summary", `${name}: record ${occurrence.ordinal}`);
      summary.title = "Zero-based event ordinal, not a line number";
      details.append(summary);
      for (const [label, value] of [["Path", source.original_path], ["Snapshot", source.snapshot],
        ["SHA256", source.sha256], ["Bytes", source.bytes]]) {
        details.append(element("p", `${label}: ${value}`, "source-details"));
      }
      byId("source-list").append(details);
    }
    pager("sources", state.sourceOffset, data.occurrences.length, data.occurrence_count, SOURCE_PAGE, "sources");
    notice("evidence-status", "");
    notice("sources-status", "");
    byId("sources-status").hidden = true;
    byId("evidence-content").hidden = false;
    setCodeCopyEnabled(true);
    checkSelectionScope();
  } catch (error) {
    errorNotice(statusId, error);
  }
}

byId("refresh-cases").addEventListener("click", () => loadCases());
function applyTime() {
  if (!state.summary) return;
  state.eventOffset = 0;
  state.bounds = Object.fromEntries(["start", "end"].map(
    (bound) => [bound, byId(`time-${bound}`).value.trim() || null]));
  byId("time-draft").textContent = "";
  timeSlider.sync();
  loadEvents();
}
function markTimeDraft() {
  const changed = ["start", "end"].some((key) =>
    (byId(`time-${key}`).value.trim() || null) !== (state.bounds[key] || null));
  byId("time-draft").textContent = changed ? "Unapplied time edits" : "";
}
const timeSlider = new TimeSlider({
  start: byId("slider-start"), end: byId("slider-end"),
  fields: { start: byId("time-start"), end: byId("time-end") },
  status: byId("slider-status"), track: byId("time-track"),
  onPreview: markTimeDraft, onCommit: applyTime,
});
byId("time-form").addEventListener("submit", (event) => { event.preventDefault(); applyTime(); });
byId("reset-time").addEventListener("click", () => {
  if (!state.summary) return;
  byId("time-start").value = state.summary.time_range.start || "";
  byId("time-end").value = state.summary.time_range.end || "";
  timeSlider.configure(state.summary.time_range);
  applyTime();
});
for (const bound of ["start", "end"]) {
  byId(`time-${bound}`).addEventListener("input", () => { timeSlider.sync(); markTimeDraft(); });
}
for (const [prefix, key, size, loader] of [
  ["cases", "caseOffset", CASE_PAGE, loadCases],
  ["events", "eventOffset", EVENT_PAGE, () => state.connection ? loadSupportingEvents() : loadEvents()],
  ["sources", "sourceOffset", SOURCE_PAGE, loadEvidence],
]) {
  for (const [suffix, step] of [["prev", -1], ["next", 1]]) {
    byId(`${prefix}-${suffix}`).addEventListener("click", () => {
      state[key] = Math.max(0, state[key] + step * size);
      loader();
    });
  }
}
// Code blocks share the same control contract: a button targets a text-only block.
const codeCopyButtons = [...document.querySelectorAll("[data-copy-target]")];
function setCodeCopyEnabled(enabled) {
  for (const button of codeCopyButtons) button.disabled = !enabled;
}

async function copyCode(targetId) {
  const evidence = state.evidence;
  const text = byId(targetId).textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (state.evidence === evidence) notice("evidence-status", "JSON copied.");
  } catch {
    if (state.evidence === evidence) notice("evidence-status", "Copy unavailable: select the JSON directly.", true);
  }
}
for (const button of codeCopyButtons) {
  button.addEventListener("click", () => copyCode(button.dataset.copyTarget));
}
const identityWorkbench = new IdentityWorkbench({ selectNode, selectConnection, clearConnection,
  resetInspection: () => { clearConnection(); clearEvidence(); } });
new PanelLayout();
loadCases();
