-- LIFE: additive migration from the four-table US-03 starter to TEN public tables.
-- Read these instructions before executing in Supabase SQL Editor.
-- Run ONCE as the project database owner, first in a development project.
-- Existing records are preserved. There are NO DROP TABLE statements.
-- This script is NOT a scoring engine, file-upload implementation or complete app.
-- Supabase-managed auth/storage tables are excluded from the ten-table limit.
--
-- FINAL TABLE LIST:
-- Existing: applicants, applications, documents, application_status_history.
-- New: staff_roles, application_details, application_consents,
--      rating_matrices, risk_evaluations, audit_events.
-- To stay within ten tables, form sections, matrix rules and criterion breakdowns
-- use JSONB inside their parent records. Core ownership/relationships use FKs.
--
-- AFTER RUNNING:
-- 1. Create staff users through Supabase Authentication, not by editing auth.users.
-- 2. Assign roles ONLY through trusted SQL Editor / authorized backend. Example:
--    insert into public.staff_roles(user_id, role)
--    values ('REPLACE_WITH_REAL_AUTH_USER_UUID', 'reviewer');
--    Allowed roles: reviewer, admin. Applicants have NO staff_roles row.
-- 3. Assign a reviewer through trusted SQL Editor / authorized backend:
--    update public.applications set assigned_reviewer_id = 'AUTH_USER_UUID'
--    where id = 'APPLICATION_UUID';
--    A reviewer can read only assigned applications; admins can read all.
-- 4. Re-run the earlier two-applicant test and test reviewer/admin identities.
-- 5. Keep using fictional data. Do not store full SSNs or passwords in these tables.
--
-- IMPORTANT BOUNDARIES:
-- Existing submit_application() and its draft/submitted workflow are unchanged.
-- It does NOT yet require the new details/consent fields. The backend team must
-- implement complete-form validation and atomic submission once fields are agreed.
-- This migration does not authorize reviewer status updates or build an admin UI.
-- No default scoring thresholds are invented. Insert only client-approved matrices.
-- No authenticated client can write scoring results, role assignments or audit rows.
-- A trusted scoring backend must validate its inputs and then write results.
-- No grants are added to storage.objects. Real files still need PRIVATE bucket
-- policies and application ownership checks in the upload/download workflow.
-- Audit events below record database mutations, NOT reads/downloads/login attempts.
-- Logs contain identifiers/actions only; do not add financial data or SSNs to them.
-- Reviewed against starter SQL and statically checked, not run on your live project.

begin;

-- Stop instead of guessing if the database has changed since the starter.
do $$
declare names text[];
begin
 select array_agg(tablename::text order by tablename) into names
 from pg_catalog.pg_tables where schemaname = 'public';
 if names is distinct from array[
  'applicants','application_status_history','applications','documents']::text[] then
  raise exception 'Expected exactly the four original public tables; found %. No changes applied. Review your current schema first.', names;
 end if;
 if not exists (select 1 from information_schema.columns
  where table_schema='public' and table_name='applications'
   and column_name='submission_key' and data_type='uuid') then
  raise exception 'Starter applications.submission_key UUID is missing. No changes applied.';
 end if;
end $$;

create schema if not exists lef_private;
revoke all on schema lef_private from public, anon;
grant usage on schema lef_private to authenticated;
-- Do not add lef_private to Supabase's exposed Data API schemas.

-- TABLE 5: one staff account can have both roles if explicitly assigned.
create table public.staff_roles (
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check (role in ('reviewer','admin')),
 assigned_at timestamptz not null default now(),
 primary key (user_id,role)
);

-- One reviewer per application for this MVP. A junction table is unnecessary.
alter table public.applications add column assigned_reviewer_id uuid
 references auth.users(id) on delete restrict;
create index applications_reviewer_idx on public.applications(assigned_reviewer_id);

-- TABLE 6: a snapshot belonging to THIS application, not the current profile.
create table public.application_details (
 application_id uuid primary key references public.applications(id) on delete restrict,
 first_name text not null check (length(trim(first_name)) > 0),
 middle_initial text check (middle_initial is null or length(middle_initial) <= 1),
 last_name text not null check (length(trim(last_name)) > 0),
 suffix text,
 date_of_birth date check (date_of_birth >= date '1900-01-01'),
 contact_email text not null check (length(trim(contact_email)) > 0),
 contact_phone text,
 address_line1 text,
 address_line2 text,
 city text,
 state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
 postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
 county text,
 household_size integer check (household_size is null or household_size > 0),
 is_life_client boolean,