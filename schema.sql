-- ================================================================
-- CashBook — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ================================================================

create extension if not exists "uuid-ossp";

-- ── categories ───────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('in','out')),
  color      text not null default '#6366f1',
  icon       text not null default '💡',
  created_at timestamptz default now()
);

-- ── transactions ─────────────────────────────────────────────
create table public.transactions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('in','out')),
  amount       numeric(12,2) not null check (amount > 0),
  title        text not null,
  category_id  uuid references public.categories(id) on delete set null,
  payment_mode text not null default 'cash' check (payment_mode in ('cash','bank','upi','card')),
  notes        text default '',
  date         date not null default current_date,
  created_at   timestamptz default now()
);

-- ── quick_templates ──────────────────────────────────────────
create table public.quick_templates (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  type         text not null check (type in ('in','out')),
  amount       numeric(12,2) not null default 0,
  category_id  uuid references public.categories(id) on delete set null,
  payment_mode text not null default 'cash',
  is_recurring boolean default false,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.categories      enable row level security;
alter table public.transactions    enable row level security;
alter table public.quick_templates enable row level security;

create policy "own categories"   on public.categories      for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own transactions" on public.transactions    for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own templates"    on public.quick_templates for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ── Indexes ───────────────────────────────────────────────────
create index idx_tx_user_date on public.transactions(user_id, date desc);
create index idx_tx_cat       on public.transactions(category_id);
create index idx_cat_user     on public.categories(user_id);
create index idx_tpl_user     on public.quick_templates(user_id);

-- ── Auto-seed default categories on signup ────────────────────
create or replace function public.seed_default_categories()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categories(user_id,name,type,color,icon) values
    (new.id,'Salary',      'in', '#10b981','💰'),
    (new.id,'Freelance',   'in', '#6366f1','💻'),
    (new.id,'Refund',      'in', '#f59e0b','↩️'),
    (new.id,'Other Income','in', '#14b8a6','🎁'),
    (new.id,'Food',        'out','#f97316','🍱'),
    (new.id,'Travel',      'out','#3b82f6','🚌'),
    (new.id,'Rent',        'out','#8b5cf6','🏠'),
    (new.id,'Recharge',    'out','#ec4899','📱'),
    (new.id,'Shopping',    'out','#f43f5e','🛍️'),
    (new.id,'Medical',     'out','#ef4444','💊'),
    (new.id,'Personal',    'out','#a855f7','🧴'),
    (new.id,'Business',    'out','#0ea5e9','💼');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.seed_default_categories();
