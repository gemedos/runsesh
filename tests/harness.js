// Minimal test helpers (no dependencies).

export const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err && err.message ? err.message : String(err) });
  }
}

export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} expected ${e} but got ${a}`);
}

export function ok(value, msg = 'expected truthy') {
  if (!value) throw new Error(msg);
}
