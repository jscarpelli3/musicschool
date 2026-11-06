create table public.platform_support_tickets(
 id uuid primary key default gen_random_uuid(),
 submitted_by uuid not null references public.profiles(id) on delete restrict,
 school_id uuid references public.schools(id) on delete set null,
 category text not null check(category in('problem','question','idea','billing')),
 subject text not null check(length(trim(subject)) between 3 and 120),
 notes text not null check(length(trim(notes)) between 10 and 5000),
 page_url text check(page_url is null or length(page_url)<=1000),
 status text not null default 'open' check(status in('open','in_progress','waiting_on_submitter','resolved','closed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz
);
create table public.platform_support_attachments(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.platform_support_tickets(id) on delete cascade,
 uploaded_by uuid not null references public.profiles(id) on delete restrict,storage_path text not null unique,
 original_filename text not null check(length(original_filename) between 1 and 255),mime_type text not null,
 size_bytes integer not null check(size_bytes between 1 and 5242880),created_at timestamptz not null default now()
);
create index platform_support_tickets_submitter_created_idx on public.platform_support_tickets(submitted_by,created_at desc);
create index platform_support_tickets_status_created_idx on public.platform_support_tickets(status,created_at);
create trigger platform_support_tickets_set_updated_at before update on public.platform_support_tickets for each row execute function public.set_updated_at();
alter table public.platform_support_tickets enable row level security;
alter table public.platform_support_attachments enable row level security;
revoke all on public.platform_support_tickets,public.platform_support_attachments from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('support-attachments','support-attachments',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
comment on table public.platform_support_tickets is 'Private Common Time support requests, separate from school operational and financial records.';
comment on table public.platform_support_attachments is 'Private screenshot metadata. Objects are accessible only through privileged support tooling.';
