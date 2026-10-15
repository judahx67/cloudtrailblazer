import test from "node:test";
import assert from "node:assert/strict";
import { queryNeighborhood } from "../backend/cloudtrailblazer/static/neighborhood-query.mjs";
import { layoutNeighborhood } from "../backend/cloudtrailblazer/static/graph.mjs";

const dense = { scope: { identity_id: "actor" }, nodes: [{ id: "actor", kind: "identity" },
  ...Array.from({ length: 213 }, (_, i) => ({ id: `group-${i}`, kind: "group", group_type: "target" }))],
  connections: Array.from({ length: 233 }, (_, i) => ({ id: `edge-${i}`, source: "actor", target: `group-${i % 213}`, kind: "action" })) };

test("raw detail threshold groups once and the returned dense graph renders completely", async () => {
  const calls = [];
  const request = { async get(url) { calls.push(url); return dense; } };
  const graph = await queryNeighborhood(request, "raw", "grouped");
  assert.deepEqual(calls, ["raw", "grouped"]);
  const layout = layoutNeighborhood(graph);
  assert.equal(layout.nodes.length, 214); assert.equal(layout.connections.length, 233);
});

test("raw projection rejection does not fetch a dense grouped result twice", async () => {
  const calls = [];
  const request = { async get(url) {
    calls.push(url);
    if (url === "raw") throw Object.assign(new Error("budget"), { status: 413, code: "projection_limit" });
    return dense;
  } };
  assert.equal(await queryNeighborhood(request, "raw", "grouped"), dense);
  assert.deepEqual(calls, ["raw", "grouped"]);
});

test("small views stay raw and unrelated errors never cause grouping", async () => {
  const small = { nodes: [], connections: [] };
  const calls = [];
  assert.equal(await queryNeighborhood({ async get(url) { calls.push(url); return small; } }, "raw", "grouped"), small);
  assert.deepEqual(calls, ["raw"]);
  const error = Object.assign(new Error("network"), { status: 500 });
  await assert.rejects(queryNeighborhood({ async get() { throw error; } }, "raw", "grouped"), e => e === error);
});
