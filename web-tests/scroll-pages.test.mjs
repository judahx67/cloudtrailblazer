import assert from "node:assert/strict";
import test from "node:test";
import { ScrollPages } from "../backend/cloudtrailblazer/static/scroll-pages.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("scroll loading serializes bounded pages, appends and stops at the end", async () => {
  const pending = deferred(), offsets = [], items = [];
  const pages = new ScrollPages((offset, limit) => {
    offsets.push([offset, limit]);
    return offset === 0 ? pending.promise : Promise.resolve({ items: [3], total: 3 });
  }, rows => items.push(...rows), () => {}, 2);
  const first = pages.next(); await pages.next();
  assert.deepEqual(offsets, [[0, 2]]);
  pending.resolve({ items: [1, 2], total: 3 }); await first;
  await pages.next(); await pages.next();
  assert.deepEqual(offsets, [[0, 2], [2, 2]]); assert.deepEqual(items, [1, 2, 3]);
  assert.equal(pages.offset, 3); assert.equal(pages.loading, false);
});

test("search/scope reset discards stale results and failures without changing the new request", async () => {
  for (const fail of [false, true]) {
    const old = deferred(), fresh = deferred(), items = [];
    let calls = 0;
    const pages = new ScrollPages(() => (++calls === 1 ? old : fresh).promise,
      rows => items.push(...rows), () => {});
    const previous = pages.next(); pages.reset(); const current = pages.next();
    if (fail) old.reject(new Error("old scope")); else old.resolve({ items: ["old"], total: 1 });
    await previous; assert.equal(pages.loading, true); assert.deepEqual(items, []);
    fresh.resolve({ items: ["fresh"], total: 1 }); await current;
    assert.deepEqual(items, ["fresh"]); assert.equal(pages.error, null);
  }
});

test("a failed next page preserves loaded rows and retries the same offset", async () => {
  const items = [], offsets = []; let fail = true;
  const pages = new ScrollPages(async offset => {
    offsets.push(offset);
    if (offset === 0) return { items: [1, 2], total: 3 };
    if (fail) { fail = false; throw new Error("offline"); }
    return { items: [3], total: 3 };
  }, rows => items.push(...rows), () => {}, 2);
  await pages.next(); await pages.next();
  assert.deepEqual(items, [1, 2]); assert.equal(pages.offset, 2); assert.match(pages.error.message, /offline/);
  await pages.next(); assert.deepEqual(offsets, [0, 2, 2]); assert.deepEqual(items, [1, 2, 3]);
});

test("empty lists stop and an inconsistent empty page fails instead of looping", async () => {
  const empty = new ScrollPages(async () => ({items: [], total: 0}), () => {}, () => {});
  await empty.next(); assert.equal(empty.total, 0); assert.equal(empty.error, null);
  const invalid = new ScrollPages(async () => ({items: [], total: 10}), () => {}, () => {});
  await invalid.next(); assert.match(invalid.error.message, /unavailable/); assert.equal(invalid.offset, 0);
});
