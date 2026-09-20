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

Open http://localhost:3000 — the seeded "HackNight 2026" event should be
there. Open it, and in the agent bar try:

```
Priya said she'll handle the venue by Friday, and we still need someone
to order pizza for 80 people.
```

Watch the task board update.
