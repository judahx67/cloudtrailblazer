// Keep timestamp arithmetic in microseconds. Number is used only for bounded UI ticks.
export function timestampMicros(value) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(`${match[1]}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== match[1]) return null;
  const zone = match[3];
  const hours = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const minutes = zone === "Z" ? 0 : Number(zone.slice(4));
  if (hours > 23 || minutes > 59) return null;
  const offset = (hours * 60 + minutes) * (zone.startsWith("-") ? -1 : 1);
  return BigInt(date.getTime() - offset * 60000) * 1000n + BigInt((match[2] || "").padEnd(6, "0"));
}

export function formatMicros(value) {
  // Floor rather than truncate for dates before the Unix epoch.
  const seconds = (value - (value % 1000000n + 1000000n) % 1000000n) / 1000000n;
  const fraction = value - seconds * 1000000n;
  return `${new Date(Number(seconds * 1000n)).toISOString().slice(0, 19)}.${String(fraction).padStart(6, "0")}+00:00`;
}

export class TimeRange {
  constructor(bounds) {
    this.start = timestampMicros(bounds.start);
    this.end = timestampMicros(bounds.end);
    this.valid = this.start !== null && this.end !== null && this.start < this.end;
    this.span = this.valid ? this.end - this.start : 0n;
    this.steps = Number(this.span < 10000n ? this.span : 10000n);
  }

  selection(bounds) {
    const start = timestampMicros(bounds.start), end = timestampMicros(bounds.end);
    return this.valid && start !== null && end !== null && start >= this.start && end <= this.end && start < end
      ? { start, end } : null;
  }

  tick(value) { return Number(((value - this.start) * BigInt(this.steps) + this.span / 2n) / this.span); }

  move(bound, tick, bounds) {
    const selection = this.selection(bounds);
    if (!selection) return null;
    const clamped = Math.max(0, Math.min(this.steps, Math.round(tick)));
    let value = this.start + this.span * BigInt(clamped) / BigInt(this.steps);
    value = bound === "start" ? (value < selection.end ? value : selection.end - 1n)
      : (value > selection.start ? value : selection.start + 1n);
    return { ...bounds, [bound]: formatMicros(value) };
  }
}

export class TimeSlider {
  constructor({ start, end, fields, status, track, onPreview, onCommit }) {
    this.handles = { start, end }; this.fields = fields; this.status = status; this.track = track;
    this.model = new TimeRange({}); this.enabled = false;
    for (const [bound, handle] of Object.entries(this.handles)) {
      handle.addEventListener("input", () => {
        const next = this.model.move(bound, Number(handle.value), this.bounds());
        if (!next) return;
        this.fields[bound].value = next[bound];
        this.sync(); onPreview();
      });
      handle.addEventListener("change", () => { if (!handle.disabled) onCommit(); });
    }
  }

  bounds() { return Object.fromEntries(Object.entries(this.fields).map(([key, field]) => [key, field.value.trim()])); }
  configure(bounds) { this.model = new TimeRange(bounds); this.sync(); }
  setEnabled(enabled) { this.enabled = enabled; this.sync(); }

  sync() {
    const selection = this.model.selection(this.bounds());
    for (const field of Object.values(this.fields)) field.title = field.value;
    for (const [bound, handle] of Object.entries(this.handles)) {
      handle.disabled = !this.enabled || !selection;
      handle.max = String(this.model.steps || 1);
      handle.value = selection ? String(this.model.tick(selection[bound])) : (bound === "start" ? "0" : handle.max);
      handle.setAttribute("aria-valuetext", selection ? `${this.fields[bound].value}: ${bound === "start" ? "included" : "excluded"}` : "Unavailable");
    }
    this.track.style.setProperty("--range-start", selection ? `${Number((selection.start - this.model.start) * 10000n / this.model.span) / 100}%` : "0%");
    this.track.style.setProperty("--range-end", selection ? `${Number((selection.end - this.model.start) * 10000n / this.model.span) / 100}%` : "100%");
    this.status.textContent = !this.enabled ? "" : !this.model.valid ? "No timed events"
      : !selection ? "Slider requires ordered bounds inside this case" : "";
  }
}
