# ClubOps AI

Agentic event management for college clubs. Full architecture, data model,
and setup steps live in [`ARCHITECTURE.md`](./ARCHITECTURE.md) — read that
first.

## Quick start

```bash
# 1. Database
#    Paste supabase/schema.sql then supabase/seed.sql into the Supabase SQL editor.

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_URL / SUPABASE_SERVICE_KEY / GEMINI_API_KEY
uvicorn main:app --reload --port 8000

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
