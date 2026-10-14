// One capture owner per gesture; cancellation never applies a final movement.
export function bindPointerDrag(handle, { start, move, end = () => {}, accepts = () => true }) {
  let active = null;
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || active || !accepts(event)) return;
    const value = start(event);
    if (value === false) return;
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, value };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener("pointermove", event => {
    if (active?.id !== event.pointerId) return;
    move(event.clientX - active.x, event.clientY - active.y, active.value);
  });
  const finish = event => {
    if (active?.id !== event.pointerId) return;
    active = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    end();
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(type, finish);
  return () => {
    if (!active) return;
    const id = active.id; active = null;
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    end();
  };
}
