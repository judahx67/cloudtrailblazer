import { byId } from "./ui.mjs";

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
    const move = byId("subgraph-move");
    move.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      this.drag = { x: event.clientX, y: event.clientY, left: this.left, top: this.top };
      move.setPointerCapture(event.pointerId);
    });
    move.addEventListener("pointermove", event => {
      if (!this.drag) return;
      this.place(this.drag.left + event.clientX - this.drag.x, this.drag.top + event.clientY - this.drag.y);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) move.addEventListener(type, () => { this.drag = null; });
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

  hide() { this.panel.hidden = true; this.drag = null; }
}
