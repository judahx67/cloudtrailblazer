import { byId } from "./ui.mjs";
import { bindPointerDrag } from "./pointer-drag.mjs";

export function constrainBox(box, stage) {
  const availableWidth = Math.max(1, stage.width - 16);
  const availableHeight = Math.max(1, stage.height - 16);
  const width = Math.min(availableWidth, Math.max(Math.min(320, availableWidth), box.width));
  const height = Math.min(availableHeight, Math.max(Math.min(200, availableHeight), box.height));
  return { width, height, left: Math.max(8, Math.min(box.left, stage.width - width - 8)),
    top: Math.max(8, Math.min(box.top, stage.height - height - 8)) };
}

// Non-modal, constrained to the graph stage. Arrow keys provide drag/resize alternatives.
export class SubgraphWindow {
  constructor(onClose) {
    this.panel = byId("subgraph-window"); this.stage = byId("graph-stage");
    this.left = 8; this.top = 8;
    for (const id of ["subgraph-close", "subgraph-back"]) byId(id).addEventListener("click", onClose);
    this.panel.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    });
    this.cancelDrags = ["subgraph-move", "subgraph-toolbar"].map(id => bindPointerDrag(byId(id), {
      accepts: event => id === "subgraph-move" || !event.target.closest("button"),
      start: () => ({ left: this.left, top: this.top }),
      move: (x, y, origin) => this.place(origin.left + x, origin.top + y),
    }));
    for (const [id, resize] of [["subgraph-move", false], ["subgraph-resize", true]]) {
      byId(id).addEventListener("keydown", event => {
        const directions = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
        if (!directions[event.key]) return;
        event.preventDefault();
        const [x, y] = directions[event.key];
        if (resize) this.place(this.left, this.top, this.panel.offsetWidth + x, this.panel.offsetHeight + y);
        else this.place(this.left + x, this.top + y);
      });
    }
    const observer = new ResizeObserver(() => { if (!this.panel.hidden) this.place(this.left, this.top); });
    observer.observe(this.stage); observer.observe(this.panel);
  }

  place(left, top, width = this.panel.offsetWidth, height = this.panel.offsetHeight) {
    const box = constrainBox({ left, top, width, height }, { width: this.stage.clientWidth, height: this.stage.clientHeight });
    this.left = box.left; this.top = box.top;
    Object.assign(this.panel.style, { left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px` });
  }

  show(label) {
    const fresh = this.panel.hidden;
    this.panel.hidden = false;
    byId("subgraph-title").textContent = label;
    if (fresh) {
      this.place(8, 8, Math.min(510, this.stage.clientWidth - 16), 350);
      byId("subgraph-close").focus();
    }
  }

  hide() { for (const cancel of this.cancelDrags) cancel(); this.panel.hidden = true; }
}
