-- 14: clean-up after moving the iPhone Shortcut to personal ingest tokens (option U).
--
-- The Apple Shortcut now authenticates with an `ios` ingest token (public.ingest_tokens,
-- migration 13), so the old Shortcut keys and their function are removed. From now on the
-- CLAUDE.md "Health data ingest tokens" exception replaces the "Apple Shortcut keys" one.
--
-- Run this only AFTER the ingest-steps Edge Function without the LEGACY branch is deployed.
-- Afterwards delete the `shortcut-key` Edge Function in the dashboard.
-- Any remaining Shortcut keys stop working; their users create an iPhone token instead.

drop function if exists public.ingest_shortcut_steps(text, date, integer);
drop table if exists public.shortcut_keys;

-- Migration 7 granted the service role these rights on daily_steps for the Shortcut function.
-- They stay: public.record_ingest (migration 13) writes daily_steps as the service role too.
