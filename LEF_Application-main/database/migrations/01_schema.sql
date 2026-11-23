-- Run ONCE in a NEW development Supabase project's SQL Editor.
-- Four-table US-03 milestone. No existing tables are dropped.
begin;

create table public.applicants (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id) on delete restrict,
 first_name text not null check (length(trim(first_name)) > 0),
 last_name text not null check (length(trim(last_name)) > 0),
 email text not null check (length(trim(email)) > 0),
 phone text,
 created_at timestamptz not null default now()
);
create table public.applications (
 id uuid primary key default gen_random_uuid(),
 applicant_id uuid not null references public.applicants(id) on delete restrict,
 submission_key uuid not null unique,
 loan_type text not null check (loan_type in ('Personal','Business')),
 requested_amount numeric(12,2) not null check (requested_amount > 0),
 status text not null default 'draft' check (status in ('draft','submitted')),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 constraint consistent_submission_time check (
  (status = 'draft' and submitted_at is null) or
  (status = 'submitted' and submitted_at is not null))
);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete restrict,
 document_type text not null check (length(trim(document_type)) > 0),
 storage_path text not null unique check (length(trim(storage_path)) > 0),
 original_filename text not null check (length(trim(original_filename)) > 0),
 uploaded_at timestamptz not null default now()
);
create table public.application_status_history (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete restrict,
 old_status text,
 new_status text not null,
 changed_by uuid not null references auth.users(id) on delete restrict,
 reason text, -- Applicant-visible summary only. Never put internal review notes here.
 changed_at timestamptz not null default now()
);
create index applications_applicant_idx on public.applications(applicant_id);
create index documents_application_idx on public.documents(application_id);
create index history_application_idx on public.application_status_history(application_id);
create index history_actor_idx on public.application_status_history(changed_by);

alter table public.applicants enable row level security;
alter table public.applications enable row level security;
alter table public.documents enable row level security;
alter table public.application_status_history enable row level security;

revoke all on public.applicants, public.applications, public.documents,
 public.application_status_history from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.applicants, public.applications, public.documents,
 public.application_status_history to authenticated;
grant insert (auth_user_id,first_name,last_name,email,phone)
 on public.applicants to authenticated;
grant insert (applicant_id,submission_key,loan_type,requested_amount)
 on public.applications to authenticated;
grant update (loan_type,requested_amount) on public.applications to authenticated;
grant insert (application_id,document_type,storage_path,original_filename)
 on public.documents to authenticated;

create policy own_profile_read on public.applicants for select to authenticated
 using (auth_user_id = (select auth.uid()));
create policy own_profile_insert on public.applicants for insert to authenticated
 with check (auth_user_id = (select auth.uid()));
create policy own_applications_read on public.applications for select to authenticated
 using (exists (select 1 from public.applicants p
  where p.id = applicant_id and p.auth_user_id = (select auth.uid())));
create policy own_applications_insert on public.applications for insert to authenticated
 with check (status = 'draft' and submitted_at is null and exists
  (select 1 from public.applicants p where p.id = applicant_id
   and p.auth_user_id = (select auth.uid())));
create policy own_drafts_update on public.applications for update to authenticated
 using (status = 'draft' and exists (select 1 from public.applicants p
  where p.id = applicant_id and p.auth_user_id = (select auth.uid())))
 with check (status = 'draft' and exists (select 1 from public.applicants p
  where p.id = applicant_id and p.auth_user_id = (select auth.uid())));
create policy own_documents_read on public.documents for select to authenticated
 using (exists (select 1 from public.applications a where a.id = application_id));
create policy own_draft_documents_insert on public.documents for insert to authenticated
 with check (exists (select 1 from public.applications a
  where a.id = application_id and a.status = 'draft'));
create policy own_history_read on public.application_status_history
 for select to authenticated
 using (exists (select 1 from public.applications a where a.id = application_id));
-- Nested SELECTs above inherit application/profile RLS.
-- No applicant DELETE grants or direct history/status write grants.

create function public.record_application_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then
  raise exception 'Authenticated actor required';
 end if;
 if TG_OP = 'INSERT' then
  insert into public.application_status_history
   (application_id,old_status,new_status,changed_by,reason)
  values (NEW.id,null,NEW.status,auth.uid(),'Application draft created');
 elsif OLD.status is distinct from NEW.status then
  insert into public.application_status_history
   (application_id,old_status,new_status,changed_by,reason)
  values (NEW.id,OLD.status,NEW.status,auth.uid(),'Application submitted');
 end if;
 return NEW;
end $$;
revoke all on function public.record_application_status() from public,anon,authenticated;
create trigger application_status_event
 after insert or update of status on public.applications
 for each row execute function public.record_application_status();

-- Atomic draft submission + trigger-generated history.
-- Owner check is explicit because this function bypasses RLS.
-- Calling it again for the same submitted application returns the same ID.
create function public.submit_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare selected_id uuid; selected_status text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select a.id,a.status into selected_id,selected_status
 from public.applications a join public.applicants p on p.id = a.applicant_id
 where a.id = p_application_id and p.auth_user_id = auth.uid()
 for update of a;
 if selected_id is null then raise exception 'Application unavailable'; end if;
 if selected_status = 'submitted' then return selected_id; end if;
 update public.applications set status = 'submitted', submitted_at = now()
 where id = selected_id;
 return selected_id;
end $$;
revoke all on function public.submit_application(uuid) from public,anon,authenticated;
grant execute on function public.submit_application(uuid) to authenticated;
commit;

-- Keep the same submission_key when retrying draft creation.
-- If INSERT reports duplicate submission_key, SELECT that owned row instead.
-- This starter does not enforce missing future form fields/consents/documents.
