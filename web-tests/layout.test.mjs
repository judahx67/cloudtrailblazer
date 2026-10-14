import assert from "node:assert/strict";
import test from "node:test";
import { bindPointerDrag } from "../backend/cloudtrailblazer/static/pointer-drag.mjs";
import { PanelLayout } from "../backend/cloudtrailblazer/static/panel-layout.mjs";
import { SubgraphWindow } from "../backend/cloudtrailblazer/static/subgraph-window.mjs";

class Control extends EventTarget {
  constructor(width = 510, height = 350) {
    super(); this.style = {}; this.dataset = {}; this.attributes = {}; this.captures = new Set();
    this.clientWidth = width; this.clientHeight = height;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  closest() { return null; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  focus() {}
  get offsetWidth() { return parseFloat(this.style.width) || this.clientWidth; }
  get offsetHeight() { return parseFloat(this.style.height) || this.clientHeight; }
}
function send(target, type, fields = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { button: 0, pointerId: 1, clientX: 0, clientY: 0, ...fields });
  target.dispatchEvent(event); return event;
}
function environment(t, width = 1200) {
  const controls = new Map(), root = new Control(width, 850);
  const get = id => { if (!controls.has(id)) controls.set(id, new Control()); return controls.get(id); };
  for (const key of ["document", "window", "ResizeObserver"]) {
    const previous = globalThis[key]; t.after(() => { globalThis[key] = previous; });
  }
  globalThis.document = { getElementById: get, querySelector: () => root };
  globalThis.window = Object.assign(new EventTarget(), { innerWidth: width });
  globalThis.ResizeObserver = class { observe() {} };
  return { get, root };
}

test("pointer capture follows one gesture and cancellation releases it", () => {
  const control = new Control(), results = [];
  const cancel = bindPointerDrag(control, { start: () => 7, move: (...args) => results.push(args) });
  send(control, "pointerdown", { button: 2 }); assert.equal(control.captures.size, 0);
  send(control, "pointerdown", { clientX: 10, clientY: 20 });
  send(control, "pointermove", { pointerId: 2, clientX: 500 }); assert.equal(results.length, 0);
  send(control, "pointermove", { clientX: 35, clientY: 42 });
  assert.deepEqual(results, [[25, 22, 7]]);
  send(control, "pointercancel"); assert.equal(control.captures.size, 0);
  send(control, "pointermove", { clientX: 100 }); assert.equal(results.length, 1);
  send(control, "pointerdown"); cancel(); assert.equal(control.captures.size, 0);
});

test("panel pointer and keyboard resizing preserve neighboring minimum space and reset", t => {
  const { get, root } = environment(t);
  const layout = new PanelLayout(), cases = get("cases-divider"), evidence = get("evidence-divider");
  send(cases, "pointerdown", { clientX: 180 }); send(cases, "pointermove", { clientX: 250 }); send(cases, "pointerup");
  assert.equal(layout.current.cases, 250);
  send(evidence, "pointerdown", { clientX: 860 }); send(evidence, "pointermove", { clientX: 800 }); send(evidence, "pointerup");
  assert.equal(layout.current.evidence, 390);
  send(evidence, "keydown", { key: "End" });
  assert.equal(root.clientWidth - layout.current.cases - layout.current.evidence - 16, 320);
  send(cases, "keydown", { key: "Home" }); assert.equal(cases.attributes["aria-valuenow"], "150");
  send(get("reset-layout"), "click"); assert.equal(layout.current.cases, 180); assert.equal(layout.current.evidence, 330);
});

test("stacked panels resize vertically and responsive modes retain independent sizes", t => {
  const { get, root } = environment(t, 430);
  const layout = new PanelLayout(), cases = get("cases-divider"), evidence = get("evidence-divider");
  assert.equal(cases.attributes["aria-orientation"], "horizontal");
  const total = layout.current.cases + layout.current.main + layout.current.evidence;
  send(cases, "keydown", { key: "ArrowDown" }); assert.equal(layout.current.cases, 216);
  send(evidence, "pointerdown"); send(evidence, "pointermove", { clientY: 10000 }); send(evidence, "pointerup");
  assert.equal(layout.current.evidence, 220);
  assert.equal(layout.current.cases + layout.current.main + layout.current.evidence, total);
  window.innerWidth = root.clientWidth = 920; layout.refresh();
  assert.equal(cases.attributes["aria-orientation"], "vertical");
  assert.equal(evidence.attributes["aria-orientation"], "horizontal");
  window.innerWidth = root.clientWidth = 430; layout.refresh(); assert.equal(layout.current.cases, 216);
});

test("window header dragging clamps to stage and closing cancels captured movement", t => {
  const { get } = environment(t);
  Object.assign(get("graph-stage"), { clientWidth: 800, clientHeight: 600 });
  const view = new SubgraphWindow(() => {}); view.show("actor > group");
  const header = get("subgraph-toolbar");
  header.closest = () => get("subgraph-close");
  send(header, "pointerdown"); assert.equal(header.captures.size, 0);
  header.closest = () => null;
  send(header, "pointerdown", { clientX: 100, clientY: 100 });
  send(header, "pointermove", { clientX: 160, clientY: 150 });
  assert.equal(view.left, 68); assert.equal(view.top, 58);
  send(header, "pointermove", { clientX: 10000, clientY: 10000 });
  assert.equal(view.left + get("subgraph-window").offsetWidth, 792);
  view.hide(); assert.equal(header.captures.size, 0);
  send(header, "pointermove", { clientX: 100 }); assert.equal(get("subgraph-window").hidden, true);
});
