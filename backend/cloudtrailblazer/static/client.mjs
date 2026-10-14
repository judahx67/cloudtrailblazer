export class LatestRequest {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) {
    this.fetcher = fetcher;
    this.active = null;
  }

  cancel() {
    this.active?.abort();
    this.active = null;
  }

  #assertCurrent(controller) {
    if (this.active !== controller || controller.signal.aborted) {
      throw new DOMException("Superseded request", "AbortError");
    }
  }

  async get(url) {
    this.cancel();
    const controller = new AbortController();
    this.active = controller;
    try {
      const response = await this.fetcher(url, { signal: controller.signal });
      const data = await response.json();
      this.#assertCurrent(controller);
      if (!response.ok) {
        const error = new Error(data.error?.message || `Request failed: ${response.status}`);
        error.status = response.status; error.code = data.error?.code;
        throw error;
      }
      return data;
    } catch (error) {
      // Superseded failures must not overwrite a newer view's status either.
      this.#assertCurrent(controller);
      throw error;
    }
  }
}

// Inputs here are the server's canonical UTC timestamps. Preserve microseconds:
// Date.parse would round a last-event boundary to milliseconds.
function utcKey(value) {
  return value.replace(/(?:\.(\d+))?\+00:00$/, (_, fraction) =>
    `.${(fraction || "").padEnd(6, "0")}Z`);
}

export function evidenceInScope(time, scope) {
  return (!scope.start || utcKey(time) >= utcKey(scope.start)) &&
    (!scope.end || utcKey(time) < utcKey(scope.end));
}

export function pageLabel(offset, count, total, noun) {
  return count ? `${offset + 1}-${offset + count} / ${total}` : `0 / ${total} ${noun}`;
}
