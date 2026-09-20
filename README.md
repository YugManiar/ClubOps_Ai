# ClubOps AI

Agentic event management for college clubs. Full architecture, data model,
and setup steps live in [`ARCHITECTURE.md`](./ARCHITECTURE.md) — read that
first.

## Quick start

```bash
# 1. Database — run these in the Supabase SQL editor IN ORDER.
#    The migrations are not optional: 004 is what stops one club reading
#    another club's rows through the anon key.
#      supabase/schema.sql
#      supabase/seed.sql
#      supabase/migrations/002_auth_roles.sql
#      supabase/migrations/003_demo_auth_data.sql
#      supabase/migrations/004_tenant_rls.sql        # club-scoped RLS
#      supabase/migrations/005_tenant_identity.sql   # per-club emails + invites
#      supabase/migrations/006_integrity_and_jobs.sql
#      supabase/migrations/007_rag_thresholds.sql
#      supabase/migrations/008_signup_role_choice.sql  # leader/member at signup
#      supabase/migrations/009_account_deletion.sql    # delete-account cascade + trigger fix

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # every var is validated at startup; see the comments in it
uvicorn main:app --reload --port 8000

# Optional: prove the agent's tenant boundary still holds (no network needed)
python tests/test_tenant_binding.py

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_* keys
npm run dev
```

## Theming

The whole look (light and dark) lives in one place: the `:root` and `.dark` blocks at the
top of `frontend/app/globals.css`, in the format [tweakcn](https://tweakcn.com) exports for
shadcn/ui on Tailwind v3. To re-skin the app, design a theme in tweakcn, pick **Tailwind v3**
in its Code panel, and paste its two blocks over the existing ones. Keep the eight status
lines (`--success`, `--warning`, `--danger`, `--info` and their `-foreground` twins); a
tweakcn export doesn't include them and the badges need them.

Colours are HSL channels (`243 75% 59%`), never a full colour, so opacity modifiers like
`bg-primary/10` keep working. Text on a tinted badge must stay readable in both themes, so
re-check contrast after changing a colour. The dark/light toggle is in the header and
remembers the choice.

Open http://localhost:3000 — the seeded "HackNight 2026" event should be
there. Open it, and in the agent bar try:

```
Priya said she'll handle the venue by Friday, and we still need someone
to order pizza for 80 people.
```

Watch the task board update.
