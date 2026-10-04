// "runsesh on iPhone" set-up screen: install as a Home Screen app, log in inside it, and send
// steps from Apple Health with an Apple Shortcut (personal ingest token, CLAUDE.md "Health data
// ingest tokens") or by hand.
//
// The token is shown once for copying by the shared token card (js/ui/ingestTokens.js) and is
// never written to any storage or logged.

import { STRINGS } from '../../strings.js';
import { card, screenHeader } from '../components.js';
import { h } from '../dom.js';
import { ingestUrlField, tokenCard } from '../ingestTokens.js';
import { isIos, isStandalone, shareIcon } from '../installHint.js';

const T = STRINGS.iphone;

function deviceStatus() {
  if (!isIos()) return { text: T.statusOther, cls: 'device-status' };
  if (isStandalone()) return { text: T.statusInstalled, cls: 'device-status device-status--ok' };
  return { text: T.statusBrowser, cls: 'device-status device-status--todo' };
}

function buildCard(toast) {
  return card(T.buildTitle,
    h('ol', { class: 'steps-list' }, T.buildSteps.map((text) => h('li', { text }))),
    ingestUrlField(T.urlLabel, toast),
    h('p', { class: 'hint', text: T.limitsNote }),
  );
}

export function renderIphone({ navigate, toast }) {
  const status = deviceStatus();
  return h('div', { class: 'page' },
    screenHeader(T.title),
    card(T.statusTitle, h('p', { class: status.cls, text: status.text })),
    card(T.installTitle,
      h('ol', { class: 'steps-list' },
        T.installSteps.map((text, i) => h('li', {}, text, i === 1 ? h('span', { class: 'steps-list-icon' }, shareIcon()) : null)),
      ),
    ),
    card(T.loginTitle, h('p', { class: 'health-card-text', text: T.loginText })),
    card(T.stepsTitle,
      h('p', { class: 'health-card-text', text: T.stepsText }),
      h('button', { class: 'btn btn-secondary', text: T.manualAction, attrs: { type: 'button' }, on: { click: () => navigate('profile/health') } }),
    ),
    tokenCard('ios', { title: T.tokenTitle, intro: T.tokenIntro, none: T.tokenNone, create: T.tokenCreate }, toast),
    buildCard(toast),
    card(T.updateTitle, h('p', { class: 'health-card-text', text: T.updateText })),
  );
}
