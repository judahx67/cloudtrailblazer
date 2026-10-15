import test from "node:test";
import assert from "node:assert/strict";
import { timestampMicros, formatMicros, TimeRange, TimeSlider } from "../backend/cloudtrailblazer/static/time-slider.mjs";

test("timestamp conversion preserves microseconds, offsets and pre-epoch times", () => {
  for (const text of ["2024-08-18T13:05:25.000001+00:00", "1969-12-31T23:59:59.999999+00:00", "0001-01-01T00:00:00.000001+00:00"]) {
    assert.equal(formatMicros(timestampMicros(text)), text);
  }
  assert.equal(timestampMicros("2024-08-18T20:05:25.000001+07:00"), timestampMicros("2024-08-18T13:05:25.000001Z"));
  for (const invalid of ["2024-02-30T00:00:00Z", "2024-08-18T13:00:00+24:00", "2024-08-18T13:00:00", "garbage"]) {
    assert.equal(timestampMicros(invalid), null);
  }
});

test("single-timestamp cases keep the exclusive last-event microsecond", () => {
  const bounds = { start: "2024-08-18T13:05:25+00:00", end: "2024-08-18T13:05:25.000001+00:00" };
  const model = new TimeRange(bounds);
  assert.equal(model.steps, 1);
  assert.equal(model.move("start", 1, bounds).start, "2024-08-18T13:05:25.000000+00:00");
  assert.equal(model.move("end", 0, bounds).end, bounds.end);
});

test("crossing clamps without changing the opposite exact bound; full extent stays exact", () => {
  const bounds = { start: "2024-08-18T00:00:00+00:00", end: "2024-08-19T00:00:00.000001+00:00" };
  const model = new TimeRange(bounds);
  const draft = { ...bounds, end: "2024-08-18T12:00:00.000003+00:00" };
  const moved = model.move("start", 10000, draft);
  assert.equal(moved.end, draft.end);
  assert.equal(timestampMicros(moved.start), timestampMicros(draft.end) - 1n);
  assert.equal(model.move("end", 10000, bounds).end, bounds.end);
  for (const tick of [1, 2, 9999]) {
    const moved = model.move("start", tick, bounds);
    assert.equal(model.tick(timestampMicros(moved.start)), tick);
  }
  assert.equal(model.selection({ ...bounds, start: "" }), null);
  assert.equal(model.selection({ ...bounds, start: "2024-08-17T00:00:00Z" }), null);
  assert.equal(new TimeRange({}).valid, false);
});

function control(value = "") {
  return { value, disabled: false, handlers: {}, attributes: {}, style: { setProperty() {} },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; } };
}

test("preview updates exact fields without queries; change commits; reset and invalid drafts disable handles", () => {
  const bounds = { start: "2024-08-18T00:00:00Z", end: "2024-08-19T00:00:00Z" };
  const start = control(), end = control();
  const fields = { start: control(bounds.start), end: control(bounds.end) };
  let previews = 0, commits = 0;
  const slider = new TimeSlider({ start, end, fields, status: control(), track: control(),
    onPreview: () => previews++, onCommit: () => commits++ });
  slider.configure(bounds); slider.setEnabled(true);
  start.value = "5000"; start.handlers.input();
  assert.equal(fields.start.value, "2024-08-18T12:00:00.000000+00:00");
  assert.equal(fields.end.value, bounds.end);
  assert.equal(previews, 1); assert.equal(commits, 0);
  start.handlers.change(); assert.equal(commits, 1);
  fields.start.value = "invalid"; slider.sync();
  assert.equal(start.disabled, true); assert.equal(end.disabled, true);
  start.handlers.change(); assert.equal(commits, 1);
  fields.start.value = bounds.start; slider.configure(bounds);
  assert.equal(start.value, "0"); assert.equal(end.value, "10000");
  slider.setEnabled(false); assert.equal(start.disabled, true);
});
