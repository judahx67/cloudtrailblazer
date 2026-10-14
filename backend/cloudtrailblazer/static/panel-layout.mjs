import { byId } from "./ui.mjs";
import { bindPointerDrag } from "./pointer-drag.mjs";

export function clampSize(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

// Sizes stay in this tab. Responsive modes keep independent sizes and a reset path.
export class PanelLayout {
  constructor() {
    this.root = document.querySelector(".workbench");
    this.sizes = {}; this.mode = null;
    for (const [id, key] of [["cases-divider", "cases"], ["evidence-divider", "evidence"]]) {
      const handle = byId(id);
      bindPointerDrag(handle, {
        start: () => ({ mode: this.mode, size: this.current[key] }),
        move: (x, y, origin) => {
          if (origin.mode !== this.mode) return;
          const delta = this.axis(key) === "x" ? x : y;
          this.set(key, origin.size + (key === "evidence" ? -delta : delta));
        },
      });
      handle.addEventListener("keydown", event => {
        const axis = this.axis(key);
        const change = axis === "x" ? { ArrowLeft: -16, ArrowRight: 16 } : { ArrowUp: -16, ArrowDown: 16 };
        if (!(event.key in change) && !["Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const [min, max] = this.limits(key);
        const delta = (key === "evidence" ? -1 : 1) * (change[event.key] || 0);
        this.set(key, event.key === "Home" ? min : event.key === "End" ? max : this.current[key] + delta);
      });
    }
    byId("reset-layout").addEventListener("click", () => { this.sizes = {}; this.refresh(); });
    new ResizeObserver(() => this.refresh()).observe(this.root);
    window.addEventListener("resize", () => this.refresh());
    this.refresh();
  }

  axis(key) { return this.mode === "wide" || (this.mode === "medium" && key === "cases") ? "x" : "y"; }

  limits(key) {
    const width = this.root.clientWidth;
    if (this.mode === "wide") return key === "cases"
      ? [150, width - this.current.evidence - 320 - 16]
      : [240, width - this.current.cases - 320 - 16];
    if (this.mode === "medium" && key === "cases") return [150, width - 320 - 8];
    if (key === "cases") return [150, this.current.cases + this.current.main - 360];
    return [220, this.current.evidence + this.current.main - 360];
  }

  set(key, value) {
    const previous = this.current[key];
    this.current[key] = clampSize(value, ...this.limits(key));
    if (this.axis(key) === "y") this.current.main -= this.current[key] - previous;
    this.render();
  }

  refresh() {
    const mode = window.innerWidth > 1100 ? "wide" : window.innerWidth > 620 ? "medium" : "narrow";
    this.mode = mode;
    this.current = this.sizes[mode] ||= { cases: mode === "narrow" ? 200 : 180,
      evidence: mode === "wide" ? 330 : mode === "medium" ? 300 : 480, main: 600 };
    if (mode === "medium") this.current.main = Math.max(360, this.root.clientHeight - this.current.evidence - 8);
    // A smaller viewport must release space from both side panels before rendering.
    if (mode === "wide") this.current.evidence = clampSize(this.current.evidence, 240, this.root.clientWidth - 150 - 320 - 16);
    if (mode !== "narrow") this.current.cases = clampSize(this.current.cases, ...this.limits("cases"));
    this.render();
  }

  render() {
    const { cases, evidence, main } = this.current;
    this.root.dataset.layout = this.mode;
    this.root.style.gridTemplateColumns = this.mode === "wide"
      ? `${cases}px 8px minmax(0, 1fr) 8px ${evidence}px`
      : this.mode === "medium" ? `${cases}px 8px minmax(0, 1fr)` : "minmax(0, 1fr)";
    this.root.style.gridTemplateRows = this.mode === "wide" ? "minmax(0, 1fr)"
      : this.mode === "medium" ? `${main}px 8px ${evidence}px` : `${cases}px 8px ${main}px 8px ${evidence}px`;
    for (const [id, key] of [["cases-divider", "cases"], ["evidence-divider", "evidence"]]) {
      const handle = byId(id), [min, max] = this.limits(key);
      handle.setAttribute("aria-orientation", this.axis(key) === "x" ? "vertical" : "horizontal");
      handle.setAttribute("aria-valuemin", String(min)); handle.setAttribute("aria-valuemax", String(Math.max(min, max)));
      handle.setAttribute("aria-valuenow", String(this.current[key]));
      handle.setAttribute("aria-valuetext", `${this.current[key]} pixels`);
    }
  }
}
