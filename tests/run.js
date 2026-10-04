// In-browser test runner. Serve the repo locally and open tests/index.html.
import './ranking.test.js';
import './avatar.test.js';
import './competition.test.js';
import './auth.test.js';
import './party.test.js';
import './ingestTokens.test.js';
import { results } from './harness.js';

const out = document.getElementById('results');
const failed = results.filter((r) => !r.ok);
const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.error}`}`);
lines.push('', `${results.length - failed.length}/${results.length} passed`);
out.textContent = lines.join('\n');
document.title = failed.length ? 'FAILED' : 'PASSED';
