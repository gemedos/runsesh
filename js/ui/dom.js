// Tiny DOM helpers. Everything is built with createElement / createElementNS and
// textContent. Never use innerHTML or string-built markup in this project.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: fn } }, 'Label', childNode)
 * String children become text nodes, so they are never parsed as HTML.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

/** Same as h() but in the SVG namespace. */
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) el.setAttribute(name, String(value));
  }
  appendChildren(el, children);
  return el;
}

function applyProps(el, props) {
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = String(props.text);
  if (props.attrs) {
    for (const [name, value] of Object.entries(props.attrs)) {
      if (name.startsWith('on')) throw new Error('Use props.on for event handlers');
      if (value === false || value === undefined || value === null) continue;
      el.setAttribute(name, value === true ? '' : String(value));
    }
  }
  if (props.dataset) Object.assign(el.dataset, props.dataset);
  if (props.on) {
    for (const [type, fn] of Object.entries(props.on)) el.addEventListener(type, fn);
  }
}

function appendChildren(el, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Views can register work that needs the node to be in the document (e.g. scrolling).
// The app calls runMountHooks() after inserting a view; hooks of nodes that never
// made it into the document (stale renders) are dropped.
let pendingMountHooks = [];

export function onMount(node, fn) {
  pendingMountHooks.push({ node, fn });
}

export function runMountHooks() {
  const hooks = pendingMountHooks;
  pendingMountHooks = [];
  for (const { node, fn } of hooks) if (node.isConnected) fn();
}
