import test from "node:test";
import assert from "node:assert/strict";
import { focusTrail, TrailView } from "../backend/cloudtrailblazer/static/trail.mjs";

const graph = { scope: { identity_id: "actor" }, event_count: 9,
  nodes: [{ id: "actor", label: "Actor", event_count: 9 }, { id: "ip", label: "IP", event_count: 5 },
    { id: "target", label: "Target", event_count: 4 }],
  connections: [{ id: "source", source: "ip", target: "actor", event_count: 5 },
    { id: "action", source: "actor", target: "target", event_count: 4 },
    { id: "failed", source: "actor", target: "target", event_count: 2, outcome: "failed" }] };

test("node trails include all incident outcomes and avoid inventing transitive links or summed counts", () => {
  const view = focusTrail(graph, "node", "target");
  assert.deepEqual(view.connections.map(item => item.id), ["action", "failed"]);
  assert.deepEqual(view.nodes.map(item => item.id), ["actor", "target"]);
  assert.equal(view.event_count, 4);
  assert.equal(view.scope, graph.scope);
  assert.equal(graph.connections.length, 3);
});
test("connection trails isolate exact evidence IDs and support self loops and missing-item errors", () => {
  const view = focusTrail(graph, "connection", "failed");
  assert.equal(view.connections.length, 1); assert.equal(view.connections[0], graph.connections[2]);
  assert.equal(view.event_count, 2);
  const loop = { ...graph, connections: [{ id: "loop", source: "actor", target: "actor", event_count: 1 }] };
  assert.equal(focusTrail(loop, "connection", "loop").nodes.length, 1);
  assert.throws(() => focusTrail(graph, "node", "missing"), /no longer/);
});
test("preview does not open a view; follow and back restore full graph; scope reset invalidates old candidates", () => {
  const control = () => ({ listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {} });
  const follow = control(), back = control(), label = control(), views = [];
  const trail = new TrailView({ follow, back, label, onView: view => views.push(view) });
  trail.reset(graph); trail.preview("node", graph.nodes[2]);
  assert.equal(views.length, 0); assert.equal(follow.disabled, false);
  follow.listeners.click(); assert.equal(views[0].connections.length, 2); assert.equal(back.hidden, false);
  back.listeners.click(); assert.equal(views[1], graph); assert.equal(back.hidden, true);
  trail.preview("connection", { ...graph.connections[2], action: "DeleteTrail", label: { x: 10, y: 20 } });
  assert.equal(trail.candidate.label, "DeleteTrail");
  trail.reset(); follow.listeners.click(); assert.equal(views.length, 2); assert.equal(follow.disabled, true);
});
