import assert from "node:assert/strict";
import test from "node:test";
import { connectionLabel, layoutNeighborhood } from "../backend/cloudtrailblazer/static/graph.mjs";

const node = (id, kind = "service") => ({ id, kind, label: "same label", identifier: id });
const edge = (id, source, target, outcome = "failed") => ({ id, source, target,
  kind: source === "ip" ? "observed_source" : "action", action: "DeleteTrail", outcome, event_count: 2 });
const graph = (nodes, connections) => ({ scope: { identity_id: "actor" }, nodes, connections });

test("every recorded connection keeps its own ID, outcome and direction", () => {
  const input = graph([node("actor", "identity"), node("ip", "ip"), node("target")], [
    edge("failed", "actor", "target"), edge("reported", "actor", "target", "success"),
    edge("source", "ip", "actor"),
  ]);
  const layout = layoutNeighborhood(input);
  assert.equal(layout.nodes.length, 3);
  assert.deepEqual(layout.connections.map(item => [item.id, item.source, item.target, item.outcome]),
    [...input.connections].sort((a, b) => a.id.localeCompare(b.id)).map(item => [item.id, item.source, item.target, item.outcome]));
  assert.equal(new Set(layout.connections.map(item => `${item.label.x}:${item.label.y}`)).size, 3);
  assert.match(connectionLabel(input.connections[0]), /failed attempt/);
  assert.match(connectionLabel(input.connections[1]), /no error reported/);
  assert.match(connectionLabel(input.connections[2]), /Source observed/);
});

test("surviving node positions and connection labels stay fixed as scope shrinks or expands", () => {
  const positions = new Map();
  const original = graph([node("actor", "identity"), node("b"), node("c")], [
    edge("b-edge", "actor", "b"), edge("c-edge", "actor", "c"),
  ]);
  const first = layoutNeighborhood(original, positions);
  const smaller = layoutNeighborhood(graph([node("actor", "identity"), node("c")], [edge("c-edge", "actor", "c")]), positions);
  const larger = layoutNeighborhood(graph([...original.nodes, node("a")], [...original.connections, edge("a-edge", "actor", "a")]), positions);
  for (const view of [smaller, larger]) {
    const survivor = view.nodes.find(item => item.id === "c");
    assert.deepEqual([survivor.x, survivor.y], [first.nodes[2].x, first.nodes[2].y]);
    assert.deepEqual(view.connections.find(item => item.id === "c-edge").label, first.connections[1].label);
  }
});

test("dense neighborhoods fail explicitly without changing position history or dropping links", () => {
  const positions = new Map();
  assert.throws(() => layoutNeighborhood(graph(Array.from({ length: 501 }, (_, i) => node(String(i))), []), positions), /Render limit exceeded/);
  assert.throws(() => layoutNeighborhood(graph([node("actor", "identity")], Array.from({ length: 1501 }, (_, i) => edge(String(i), "actor", "actor"))), positions), /Render limit exceeded/);
  assert.equal(positions.size, 0);
});

test("dense grouped output preserves every node and connection above the detail threshold", () => {
  const nodes = [node("actor", "identity"), ...Array.from({ length: 213 }, (_, i) =>
    ({ ...node(`bucket-${i}`, "group"), group_type: "target" }))];
  const connections = Array.from({ length: 233 }, (_, i) => edge(`activity-${i}`, "actor", `bucket-${i % 213}`));
  const input = graph(nodes, connections);
  const layout = layoutNeighborhood(input);
  assert.equal(layout.nodes.length, 214);
  assert.deepEqual(new Set(layout.connections.map(item => item.id)), new Set(connections.map(item => item.id)));
  assert.equal(new Set(layout.connections.map(item => `${item.label.x}:${item.label.y}`)).size, 233);
});

test("recorded self-targets have visible loops and empty scopes are valid", () => {
  const layout = layoutNeighborhood(graph([node("actor", "role")], [edge("self", "actor", "actor")]));
  assert.ok(layout.connections[0].points.split(" ").length >= 5);
  assert.deepEqual(layoutNeighborhood(graph([], [])).nodes, []);
  assert.throws(() => layoutNeighborhood(graph([node("actor")], [edge("bad", "actor", "missing")])), /missing node/);
});

test("source groups keep the incoming lane while resource groups stay on the target side", () => {
  const layout = layoutNeighborhood(graph([node("actor", "identity"),
    { ...node("sources", "group"), group_type: "source" },
    { ...node("targets", "group"), group_type: "target" }], []));
  const lookup = new Map(layout.nodes.map(item => [item.id, item]));
  assert.ok(lookup.get("sources").x < lookup.get("actor").x);
  assert.ok(lookup.get("targets").x > lookup.get("actor").x);
});
