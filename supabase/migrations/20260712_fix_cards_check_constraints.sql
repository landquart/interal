-- Synchronize public.cards CHECK constraints with the current
-- JSON-card sections and Base62 ID prefixes.
-- Fixes PostgreSQL error 23514 observed for:
-- section = indoeuropanvordes
-- id prefix = iv
--
-- Compatibility note: legacy ID prefixes iev and gbv remain allowed so old
-- cards and discussion links do not need to be rewritten.

begin;

-- Preflight diagnostics: review these result sets before applying manually.
select
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'cards'
  and c.contype = 'c'
order by c.conname;

select
  split_part(id, '_', 1) as prefix,
  count(*) as total
from public.cards
group by 1
order by 1;

select
  id,
  section,
  category,
  status
from public.cards
where id !~ '^(iv|iev|av|in|vc|gv|gbv|al|af)_[0-9A-Za-z]{12}$';

select distinct section
from public.cards
where section not in (
  'internationalismes',
  'associativvordes',
  'indoeuropanvordes',
  'vordesofcommunites',
  'grammaticebrevivordes',
  'altervordes',
  'affixes'
);

select distinct category
from public.cards
where category is not null
  and category not in ('iv','av','in','vc','gv','al','af');

select distinct status
from public.cards
where status not in ('pending','accepted','rejected');

alter table public.cards
  drop constraint if exists cards_id_check,
  drop constraint if exists cards_section_check,
  drop constraint if exists cards_category_check,
  drop constraint if exists cards_status_check;

alter table public.cards
  add constraint cards_id_check
  check (id ~ '^(iv|iev|av|in|vc|gv|gbv|al|af)_[0-9A-Za-z]{12}$'),
  add constraint cards_section_check
  check (section in (
    'internationalismes',
    'associativvordes',
    'indoeuropanvordes',
    'vordesofcommunites',
    'grammaticebrevivordes',
    'altervordes',
    'affixes'
  )),
  add constraint cards_category_check
  check (category is null or category in ('iv','av','in','vc','gv','al','af')),
  add constraint cards_status_check
  check (status in ('pending','accepted','rejected'));

commit;
