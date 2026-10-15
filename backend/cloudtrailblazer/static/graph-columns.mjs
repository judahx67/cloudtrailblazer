import { bindPointerDrag } from "./pointer-drag.mjs";

const names = ["Source IPs", "Identity", "Targets"];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ColumnLayout {
  constructor(width = 630) { this.reset(width); }
  reset(width = this.width) {
    this.width = Math.max(630, width); this.custom = false;
    const size = clamp((this.width - 264) / 3, 122, 260);
    this.columns = [{ x: 12, width: size }, { x: (this.width - size) / 2, width: size },
      { x: this.width - size - 12, width: size }];
  }
  fit(width) {
    width = Math.max(630, width);
    if (!this.custom) { this.reset(width); return; }
    const scale = width / this.width; this.width = width;
    // Reserve room for remaining columns before clamping each lane in order.
    let left = 12;
    this.columns = this.columns.map((column, i) => {
      const right = width - 12 - (2 - i) * 182;
      const x = clamp(column.x * scale, left, right - 122);
      const size = clamp(column.width, 122, Math.min(440, right - x));
      left = x + size + 60;
      return { x, width: size };
    });
  }
  limits(index, resize = false) {
    const column = this.columns[index];
    const right = index === 2 ? this.width - 12 : this.columns[index + 1].x - 60;
    const available = index === 2 ? column.x + column.width - this.columns[1].x - this.columns[1].width - 60 : right - column.x;
    return resize ? [122, Math.min(440, available)]
      : [index === 0 ? 12 : this.columns[index - 1].x + this.columns[index - 1].width + 60,
        right - column.width];
  }
  adjust(index, value, resize = false) {
    const [min, max] = this.limits(index, resize);
    const column = this.columns[index], right = column.x + column.width;
    column[resize ? "width" : "x"] = clamp(value, min, max);
    if (resize && index === 2) column.x = right - column.width;
    this.custom = true;
  }
}

// Header controls survive SVG redraws so pointer capture and keyboard focus remain stable.
export class GraphColumns {
  constructor(container, resetButton, redraw) {
    this.container = container; this.redraw = redraw; this.model = new ColumnLayout();
    this.toolbar = document.createElement("div"); this.toolbar.className = "graph-column-controls";
    this.controls = []; this.cancel = [];
    for (let i = 0; i < 3; i++) {
      const lane = document.createElement("div"); lane.className = "graph-column-control";
      for (const resize of [false, true]) {
        const button = document.createElement("button");
        button.textContent = resize ? "Width" : names[i];
        button.setAttribute("aria-label", `${resize ? "Resize" : "Move"} ${names[i]} column`);
        button.title = `${resize ? "Resize" : "Move"}: drag horizontally or use Left/Right; Home/End use limits`;
        button.className = resize ? "column-resize" : "column-move";
        this.cancel.push(bindPointerDrag(button, {
          start: () => this.model.columns[i][resize ? "width" : "x"],
          move: (dx, _, initial) => { this.model.adjust(i, initial + dx, resize); this.update(); },
        }));
        button.addEventListener("keydown", event => {
          const [min, max] = this.model.limits(i, resize);
          const current = this.model.columns[i][resize ? "width" : "x"];
          const value = { ArrowLeft: current - (event.shiftKey ? 40 : 8),
            ArrowRight: current + (event.shiftKey ? 40 : 8), Home: min, End: max }[event.key];
          if (value === undefined) return;
          event.preventDefault(); this.model.adjust(i, value, resize); this.update();
        });
        lane.append(button); this.controls.push({ button, i, resize });
      }
      this.toolbar.append(lane);
    }
    resetButton.addEventListener("click", () => this.reset());
    document.getElementById("reset-layout").addEventListener("click", () => this.reset());
    this.observer = new ResizeObserver(() => {
      if (!this.container.querySelector("svg")) return;
      this.model.fit(this.container.clientWidth - 8); this.update();
    });
    this.observer.observe(container);
  }
  prepare() {
    this.model.fit(this.container.clientWidth - 8);
    if (!this.toolbar.isConnected) this.container.prepend(this.toolbar);
    this.paint(); return this.model;
  }
  paint() {
    this.toolbar.style.width = `${this.model.width}px`;
    [...this.toolbar.children].forEach((lane, i) => {
      lane.style.left = `${this.model.columns[i].x}px`; lane.style.width = `${this.model.columns[i].width}px`;
    });
    for (const { button, i, resize } of this.controls) {
      const value = Math.round(this.model.columns[i][resize ? "width" : "x"]);
      button.setAttribute("aria-description", `${resize ? "Width" : "Position"}: ${value} pixels`);
    }
  }
  update() { this.paint(); this.redraw(); }
  reset() {
    for (const cancel of this.cancel) cancel();
    this.model.reset(this.container.clientWidth - 8);
    if (this.container.querySelector("svg")) this.update();
  }
}
