import test from "node:test";
import assert from "node:assert/strict";
import { ColumnLayout, GraphColumns } from "../backend/cloudtrailblazer/static/graph-columns.mjs";
import { layoutNeighborhood } from "../backend/cloudtrailblazer/static/graph.mjs";

function bounded(model) {
  model.columns.forEach((column, i) => {
    assert.ok(column.width >= 122);
    assert.ok(column.x >= 12 && column.x + column.width <= model.width - 12);
    if (i) assert.ok(column.x >= model.columns[i - 1].x + model.columns[i - 1].width + 60);
  });
}
test("columns fill wide panels, constrain moves and widths, and reflow on shrink", () => {
  const model = new ColumnLayout(1600);
  assert.equal(model.columns[2].x + model.columns[2].width, 1588);
  model.adjust(1, 500); model.adjust(0, 1000, true); model.adjust(2, -1000);
  bounded(model);
  model.fit(430); bounded(model); assert.equal(model.width, 630);
  model.reset(1600); bounded(model); assert.equal(model.custom, false);
});

test("stable header controls support keyboard, captured dragging and reset without a query", () => {
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.style = {}; this.isConnected = true; this.clientWidth = 1200; }
    append(item) { this.children.push(item); }
    prepend(item) { this.children.unshift(item); }
    setAttribute() {}
    addEventListener(type, listener) { this.listeners[type] = listener; }
    querySelector() { return {}; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
  }
  const previousDocument = globalThis.document, previousObserver = globalThis.ResizeObserver;
  globalThis.document = { createElement: () => new Element(), getElementById: () => new Element() };
  globalThis.ResizeObserver = class { observe() {} };
  try {
    let redraws = 0;
    const reset = new Element(), columns = new GraphColumns(new Element(), reset, () => redraws++);
    columns.prepare();
    const move = columns.controls.find(item => item.i === 1 && !item.resize).button;
    const original = columns.model.columns[1].x;
    move.listeners.keydown({ key: "ArrowRight", preventDefault() {} });
    assert.equal(columns.model.columns[1].x, original + 8);
    move.listeners.pointerdown({ button: 0, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {} });
    move.listeners.pointermove({ pointerId: 1, clientX: 16, clientY: 0 });
    move.listeners.pointerup({ pointerId: 1 });
    assert.equal(columns.model.columns[1].x, original + 24);
    assert.equal(move.capture, null);
    const resize = columns.controls.find(item => item.i === 2 && item.resize).button;
    const width = columns.model.columns[2].width;
    resize.listeners.keydown({ key: "ArrowRight", preventDefault() {} });
    assert.equal(columns.model.columns[2].width, width + 8);
    bounded(columns.model);
    reset.listeners.click(); assert.equal(columns.model.custom, false);
    assert.equal(redraws, 4);
  } finally { globalThis.document = previousDocument; globalThis.ResizeObserver = previousObserver; }
});
test("moving and widening lanes keeps every connection attached and preserves vertical positions", () => {
  const graph = { scope: { identity_id: "actor" }, nodes: [
    { id: "ip", kind: "ip" }, { id: "actor", kind: "identity" }, { id: "target", kind: "service" }],
    connections: [{ id: "source", source: "ip", target: "actor", kind: "observed_source" },
      { id: "target", source: "actor", target: "target", kind: "action" },
      { id: "self", source: "actor", target: "actor", kind: "action" }] };
  const positions = new Map(), columns = new ColumnLayout(1600);
  const before = layoutNeighborhood(graph, positions, columns);
  columns.adjust(1, 900); columns.adjust(2, 320, true);
  const after = layoutNeighborhood(graph, positions, columns);
  assert.deepEqual(after.nodes.map(node => node.y), before.nodes.map(node => node.y));
  assert.deepEqual(after.connections.map(edge => edge.id), before.connections.map(edge => edge.id));
  const source = after.nodes.find(node => node.id === "ip");
  const target = after.nodes.find(node => node.id === "actor");
  const edge = after.connections.find(edge => edge.id === "source");
  assert.ok(edge.points.startsWith(`${source.x + source.width},${source.y + 29}`));
  assert.ok(edge.points.endsWith(`${target.x},${target.y + 29}`));
  assert.ok(after.connections.find(edge => edge.id === "self").points.split(" ").length >= 5);
});
