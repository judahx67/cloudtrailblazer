import { LatestRequest, evidenceInScope, pageLabel } from "./client.mjs";

const byId = (id) => document.getElementById(id);
const requests = Object.fromEntries(["cases", "summary", "events", "evidence"].map(
  (name) => [name, new LatestRequest()]));
const state = {
  caseId: null, summary: null, caseOffset: 0, eventOffset: 0,
  selected: null, evidence: null, sourceOffset: 0, scope: null, scopePending: false, bounds: {},
};
const CASE_PAGE = 25;
const EVENT_PAGE = 50;
const SOURCE_PAGE = 20;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function notice(id, text, error = false) {
  const node = byId(id);
  node.textContent = text;
  node.classList.toggle("error", error);
}

function errorNotice(id, error) {
  if (error.name !== "AbortError") notice(id, error.message, true);
}

function pager(prefix, offset, count, total, pageSize, noun) {
  byId(`${prefix}-page`).textContent = pageLabel(offset, count, total, noun);
  byId(`${prefix}-prev`).disabled = offset === 0;
  byId(`${prefix}-next`).disabled = offset + pageSize >= total;
}

function disablePager(prefix) {
  byId(`${prefix}-prev`).disabled = true;
  byId(`${prefix}-next`).disabled = true;
}

function casePath(suffix = "") {
  return `/api/cases/${encodeURIComponent(state.caseId)}${suffix}`;
}

function timeControls(enabled) {
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
  state.selected = null;
  state.evidence = null;
  state.sourceOffset = 0;
  byId("evidence-content").hidden = true;
  byId("copy-json").disabled = true;
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
  for (const name of ["summary", "events", "evidence"]) requests[name].cancel();
  state.caseId = item.case_id;
  state.summary = null;
  state.scope = null;
  state.bounds = {};
  state.scopePending = false;
  state.eventOffset = 0;
  clearEvidence();
  timeControls(false);
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
    timeControls(true);
    await loadEvents();
  } catch (error) {
    errorNotice("events-status", error);
    if (error.name !== "AbortError") byId("event-region").setAttribute("aria-busy", "false");
  }
}

async function loadEvents() {
  disablePager("events");
  notice("events-status", "Loading events...");
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
    for (const item of data.items) {
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
    checkSelectionScope();
    notice("events-status", data.total ? "" : "No activity in this time range.");
    pager("events", state.eventOffset, data.items.length, data.total, EVENT_PAGE, "events");
    byId("event-region").setAttribute("aria-busy", "false");
    byId("workspace-status").textContent = `Read only: ${data.total} matching events`;
  } catch (error) {
    if (error.name !== "AbortError") {
      errorNotice("events-status", error);
      state.scopePending = false;
      byId("event-region").setAttribute("aria-busy", "false");
      if (state.selected) staleNotice("Scope unavailable: selection not verified");
      byId("workspace-status").textContent = "Time query failed";
    }
  }
}

async function selectEvent(item) {
  state.selected = item;
  state.sourceOffset = 0;
  state.evidence = null;
  byId("evidence-content").hidden = true;
  byId("copy-json").disabled = true;
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
    byId("event-details").replaceChildren();
    for (const [name, value] of fields) {
      byId("event-details").append(element("dt", name), element("dd", value));
    }
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
    byId("copy-json").disabled = false;
    checkSelectionScope();
  } catch (error) {
    errorNotice(statusId, error);
  }
}

byId("refresh-cases").addEventListener("click", () => loadCases());
byId("time-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.summary) return;
  state.eventOffset = 0;
  state.bounds = Object.fromEntries(["start", "end"].map(
    (bound) => [bound, byId(`time-${bound}`).value.trim() || null]));
  byId("time-draft").textContent = "";
  loadEvents();
});
byId("reset-time").addEventListener("click", () => {
  byId("time-start").value = state.summary.time_range.start || "";
  byId("time-end").value = state.summary.time_range.end || "";
  state.eventOffset = 0;
  state.bounds = { ...state.summary.time_range };
  byId("time-draft").textContent = "";
  loadEvents();
});
for (const bound of ["start", "end"]) {
  byId(`time-${bound}`).addEventListener("input", () => {
    const changed = ["start", "end"].some((key) =>
      (byId(`time-${key}`).value.trim() || null) !== (state.bounds[key] || null));
    byId("time-draft").textContent = changed ? "Unapplied time edits" : "";
  });
}
for (const [prefix, key, size, loader] of [
  ["cases", "caseOffset", CASE_PAGE, loadCases],
  ["events", "eventOffset", EVENT_PAGE, loadEvents],
  ["sources", "sourceOffset", SOURCE_PAGE, loadEvidence],
]) {
  for (const [suffix, step] of [["prev", -1], ["next", 1]]) {
    byId(`${prefix}-${suffix}`).addEventListener("click", () => {
      state[key] = Math.max(0, state[key] + step * size);
      loader();
    });
  }
}
byId("copy-json").addEventListener("click", async () => {
  const evidence = state.evidence;
  try {
    await navigator.clipboard.writeText(evidence.event_json);
    if (state.evidence === evidence) notice("evidence-status", "JSON copied.");
  } catch {
    if (state.evidence === evidence) notice("evidence-status", "Copy unavailable: select the JSON directly.", true);
  }
});
loadCases();
