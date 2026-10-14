import { pageLabel } from "./client.mjs";

export const byId = id => document.getElementById(id);

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function notice(id, text, error = false) {
  const node = byId(id);
  node.textContent = text;
  node.classList.toggle("error", error);
}

export function pager(prefix, offset, count, total, pageSize, noun) {
  byId(`${prefix}-page`).textContent = pageLabel(offset, count, total, noun);
  byId(`${prefix}-prev`).disabled = offset === 0;
  byId(`${prefix}-next`).disabled = offset + pageSize >= total;
}

export function disablePager(prefix) {
  byId(`${prefix}-prev`).disabled = true;
  byId(`${prefix}-next`).disabled = true;
}

export function renderDetails(id, fields) {
  const list = byId(id);
  list.replaceChildren();
  for (const [name, value] of fields) {
    list.append(element("dt", name), element("dd", value ?? "Not recorded"));
  }
}
