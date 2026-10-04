// The Android app we point users to for sending steps from Health Connect. We do not build or
// ship it: users install it themselves from its GitHub releases.
// Checked on 2026-10-04: open source (MIT), sends `daily_totals` deduplicated by Health Connect.
// When updating the pinned version, re-check its docs/webhook.md "Daily totals" format against
// supabase/functions/ingest-steps/index.ts and tests/ingest-steps.node.mjs.

export const ANDROID_APP = Object.freeze({
  name: 'Life Dashboard Companion',
  nameOnPhone: 'Life Dashboard',
  version: '1.23.0',
  // SHA-256 of app-release.apk as published by GitHub for this release (also in docs/android-setup.md).
  apkSha256: '63e6f7e80055ff80e8fcaf683588e874b74caf525f194c6de28892eea9771825',
  releaseUrl: 'https://github.com/owen282000/life-dashboard-companion-app/releases/tag/1.23.0',
  repoUrl: 'https://github.com/owen282000/life-dashboard-companion-app',
});
