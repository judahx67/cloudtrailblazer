import assert from "node:assert/strict";
import test from "node:test";
import { LatestRequest, evidenceInScope, pageLabel } from "../backend/cloudtrailblazer/static/client.mjs";

test("an older response cannot replace a newer case or time selection", async () => {
  const pending = [];
  const requests = new LatestRequest((url, options) => new Promise((resolve) =>
    pending.push({ url, options, resolve })));
  const first = requests.get("old");
  const rejected = assert.rejects(first, { name: "AbortError" });
  const second = requests.get("new");
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve({ ok: true, json: async () => ({ name: "new" }) });
  assert.deepEqual(await second, { name: "new" });
  pending[0].resolve({ ok: true, json: async () => ({ name: "old" }) });
  await rejected;
});

test("canceling during JSON parsing also discards a stale response", async () => {
  let finish;
  const requests = new LatestRequest(async () => ({
    ok: true, json: () => new Promise((resolve) => { finish = resolve; }),
  }));
  const pending = requests.get("event");
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await Promise.resolve();
  requests.cancel();
  finish({ stale: true });
  await rejected;
});

test("HTTP errors retain their actionable message", async () => {
  const requests = new LatestRequest(async () => ({
    ok: false, status: 413, json: async () => ({ error: { message: "Narrow the time range" } }),
  }));
  await assert.rejects(requests.get("graph"), /Narrow the time range/);
});

test("an old network failure cannot overwrite a newer successful view", async () => {
  const pending = [];
  const requests = new LatestRequest(() => new Promise((resolve, reject) =>
    pending.push({ resolve, reject })));
  const first = requests.get("old");
  const rejected = assert.rejects(first, { name: "AbortError" });
  const second = requests.get("new");
  pending[1].resolve({ ok: true, json: async () => ({ current: true }) });
  assert.deepEqual(await second, { current: true });
  pending[0].reject(new Error("Old network failure"));
  await rejected;
});

test("scope membership preserves microsecond boundaries and an exclusive end", () => {
  const time = "2024-08-18T13:05:25+00:00";
  assert.equal(evidenceInScope(time, { start: time, end: "2024-08-18T13:05:25.000001+00:00" }), true);
  assert.equal(evidenceInScope(time, { start: null, end: time }), false);
  assert.equal(evidenceInScope("2024-08-18T13:05:25.000002+00:00", {
    start: "2024-08-18T13:05:25.000001+00:00", end: "2024-08-18T13:05:25.000002+00:00",
  }), false);
  assert.equal(evidenceInScope(time, { start: null, end: null }), true);
});

test("page labels describe counts without inventing rows", () => {
  assert.equal(pageLabel(50, 1, 51, "events"), "51-51 / 51");
  assert.equal(pageLabel(0, 0, 0, "events"), "0 / 0 events");
});
