# Supabase SQL Bootstrapping

This folder contains the first SQL migrations for V1.

## Files
1. `migrations/20260226_0001_init_schema.sql`
2. `migrations/20260226_0002_indexes_triggers_functions.sql`
3. `migrations/20260226_0003_rls_policies.sql`

## Run manually in SQL Editor (copy/paste mode)
Run the files in the exact order above.

## Promote your first admin
After creating a user with Supabase Auth, run:

```sql
select public.promote_user_to_admin('you@example.com');
```

## Quick sanity checks
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select id, role, created_at
from public.profiles
order by created_at desc
limit 20;
```

