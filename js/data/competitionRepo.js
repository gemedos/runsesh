// Competitions of the caller's party, their frozen results, and the leader's background photo.
// RLS: members read; only the leader creates/edits/deletes the active competition and
// uploads/removes the photo. Results are written only by the database.

import { SUPABASE_URL } from '../config.js';
import { isRankingMode } from '../rules/ranking.js';
import { isCompetitionTheme } from '../state/competition.js';
import { getSupabase } from '../supabaseClient.js';
import { isISODate } from '../util/date.js';
import { validateAvatar } from '../avatar/avatar.js';

const BUCKET = 'competition-backgrounds';
const COLUMNS = 'id, party_id, name, start_day, end_day, mode, golden, theme, background_path, finalized_at';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_RE = new RegExp(`^${UUID}/${UUID}\\.jpg$`);

function toCompetition(row) {
  if (!row || !isISODate(row.start_day) || !isRankingMode(row.mode)) return null;
  return Object.freeze({
    id: row.id,
    partyId: row.party_id,
    name: typeof row.name === 'string' ? row.name : '',
    start: row.start_day,
    end: isISODate(row.end_day) ? row.end_day : null,
    mode: row.mode,
    golden: row.golden === true,
    theme: isCompetitionTheme(row.theme) ? row.theme : 'circus',
    backgroundPath: typeof row.background_path === 'string' && PATH_RE.test(row.background_path) ? row.background_path : null,
    finished: Boolean(row.finalized_at),
  });
}

/** Freezes results of competitions whose last day is over (safe to call on every load). */
export async function finalizeDue() {
  try {
    await getSupabase().rpc('finalize_due_competitions');
  } catch { /* ignore: results will be frozen on a later load */ }
}

/** @returns {Promise<{active: object|null, history: object[]}>} @throws on errors */
export async function fetchCompetitions(partyId) {
  const { data, error } = await getSupabase().from('competitions').select(COLUMNS).eq('party_id', partyId).order('start_day', { ascending: false });
  if (error || !Array.isArray(data)) throw new Error('competitions');
  const all = data.map(toCompetition).filter(Boolean);
  return { active: all.find((c) => !c.finished) || null, history: all.filter((c) => c.finished) };
}

/** Frozen standings per competition id. @returns {Promise<Record<string, object[]>>} */
export async function fetchResults(competitionIds) {
  if (!competitionIds.length) return {};
  const { data, error } = await getSupabase()
    .from('competition_results')
    .select('competition_id, user_id, display_name, avatar, rank, score')
    .in('competition_id', competitionIds)
    .order('rank');
  if (error || !Array.isArray(data)) throw new Error('results');
  const out = {};
  for (const r of data) {
    if (!Number.isInteger(r.rank) || !Number.isInteger(r.score)) continue;
    (out[r.competition_id] ||= []).push(Object.freeze({
      id: r.user_id,
      name: typeof r.display_name === 'string' ? r.display_name : null,
      avatar: validateAvatar(r.avatar),
      rank: r.rank,
      value: r.score,
    }));
  }
  return out;
}

async function call(promise) {
  try {
    const { error } = await promise;
    return !error;
  } catch {
    return false;
  }
}

/** @param {{name, start, end, mode, golden}} input already validated */
export function createCompetition(partyId, input, theme = 'circus') {
  return call(getSupabase().from('competitions').insert({
    party_id: partyId, name: input.name, start_day: input.start, end_day: input.end, mode: input.mode, golden: input.golden, theme,
  }));
}

export function updateCompetition(id, patch) {
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('start' in patch) row.start_day = patch.start;
  if ('end' in patch) row.end_day = patch.end;
  if ('mode' in patch) row.mode = patch.mode;
  if ('golden' in patch) row.golden = patch.golden;
  if ('theme' in patch) {
    if (!isCompetitionTheme(patch.theme)) return Promise.resolve(false);
    row.theme = patch.theme;
  }
  if ('backgroundPath' in patch) row.background_path = patch.backgroundPath;
  return call(getSupabase().from('competitions').update(row).eq('id', id));
}

export async function deleteCompetition(competition) {
  if (competition.backgroundPath) await removeFile(competition.backgroundPath);
  return call(getSupabase().from('competitions').delete().eq('id', competition.id));
}

export function endCompetition(id) {
  return call(getSupabase().rpc('end_competition', { p_id: id }));
}

async function removeFile(path) {
  if (!PATH_RE.test(path)) return;
  try {
    await getSupabase().storage.from(BUCKET).remove([path]);
  } catch { /* an orphaned file is only wasted space */ }
}

/**
 * Uploads an already-prepared JPEG (see js/util/image.js) as the competition background,
 * then points the competition at it and removes the previous photo.
 */
export async function uploadBackground(competition, blob) {
  const path = `${competition.partyId}/${crypto.randomUUID()}.jpg`;
  if (!PATH_RE.test(path)) return false;
  try {
    const { error } = await getSupabase().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) return false;
  } catch {
    return false;
  }
  const ok = await updateCompetition(competition.id, { backgroundPath: path });
  if (!ok) {
    await removeFile(path);
    return false;
  }
  if (competition.backgroundPath) await removeFile(competition.backgroundPath);
  return true;
}

export async function removeBackground(competition) {
  if (!competition.backgroundPath) return true;
  const ok = await updateCompetition(competition.id, { backgroundPath: null });
  if (ok) await removeFile(competition.backgroundPath);
  return ok;
}

/** Short-lived signed URL for showing the photo (only to party members, enforced by storage RLS). */
export async function backgroundUrl(path) {
  if (!path || !PATH_RE.test(path)) return null;
  try {
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
    const url = !error && data && data.signedUrl;
    return typeof url === 'string' && url.startsWith(`${SUPABASE_URL}/storage/v1/`) ? url : null;
  } catch {
    return null;
  }
}
