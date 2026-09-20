# ClubOps AI — Architecture

Agentic event-ops platform for college clubs. The AI is not a chatbot bolted onto
a CRUD app — it **is** the mutation layer. Natural language (typed commands or
pasted meeting notes) goes in, Gemini function-calls into Postgres, state comes
back out.

## 1. Stack (locked — do not deviate)

| Layer        | Choice                                              |
|--------------|------------------------------------------------------|
| Frontend     | Next.js 14 (App Router), React, TypeScript, Tailwind, Shadcn UI |
| Backend      | Python, FastAPI                                     |
| DB / Auth    | Supabase (Postgres + `pgvector`)                    |
| AI           | Gemini API — function calling / structured output only, no passive chat |

No Node/Express/Mongo backends. No passive text-generation endpoints — every
agent endpoint must terminate in a DB write or return an explicit no-op.

## 2. Repo layout

```
clubops-ai/
├── ARCHITECTURE.md
├── README.md
├── supabase/
│   ├── schema.sql          # tables, FKs, pgvector index, similarity fn
│   └── seed.sql            # demo club/members/event for the 3-min demo
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── main.py             # FastAPI app, CORS, router mounts
│   └── app/
│       ├── config.py       # pydantic Settings (env vars)
│       ├── db.py           # Supabase client (service-role key)
│       ├── models/
│       │   └── schemas.py  # Pydantic request/response models
│       ├── routers/
│       │   ├── events.py   # CRUD /events
│       │   ├── tasks.py    # CRUD /tasks
│       │   └── agent.py    # POST /agent/command  <- the whole point
│       └── services/
│           ├── agent_tools.py   # Gemini function declarations + impls
│           └── gemini_client.py # agent loop (tool-call -> execute -> respond)
└── frontend/
    ├── package.json / tsconfig.json / tailwind.config.ts / next.config.mjs
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                    # dashboard: event list
    │   └── events/[eventId]/page.tsx   # event detail: task board + agent bar
    ├── components/
    │   ├── ui/                         # button, card, badge (shadcn-style)
    │   ├── event-card.tsx
    │   ├── task-board.tsx
    │   └── agent-command-bar.tsx       # sends prompts to POST /agent/command
    ├── lib/
    │   ├── supabase/client.ts          # browser client
    │   ├── supabase/server.ts          # server component client
    │   └── utils.ts
    └── types/database.ts               # hand-rolled types mirroring schema.sql
```

## 3. Data model

```mermaid
erDiagram
    CLUBS ||--o{ MEMBERS : has
    CLUBS ||--o{ EVENTS : hosts
    EVENTS ||--o{ TASKS : contains
    EVENTS ||--o{ MEETING_NOTES : logs
    EVENTS ||--o{ AGENT_ACTIONS : audits
    MEMBERS ||--o{ TASKS : assigned

    CLUBS { uuid id PK, text name }
    MEMBERS { uuid id PK, uuid club_id FK, text full_name, text email, text role }
    EVENTS { uuid id PK, uuid club_id FK, text name, text status, timestamptz start_time }
    TASKS { uuid id PK, uuid event_id FK, uuid assignee_id FK, text title, text status, text priority }
    MEETING_NOTES { uuid id PK, uuid event_id FK, text raw_text, vector embedding }
    AGENT_ACTIONS { uuid id PK, uuid event_id FK, text action_type, jsonb payload }
```

`agent_actions` exists purely for the demo: every autonomous write gets logged
so you can show a judge a live feed of "the AI just did this."

## 4. Agentic flow (the core loop)

```
User types/pastes text (command or meeting notes)
        │
        ▼
POST /agent/command { event_id, prompt }
        │
        ▼
Gemini model, given TOOL_DECLARATIONS (create_task, create_event,
update_task_status, assign_task, list_members)
        │
        ▼
Gemini returns one or more function_call parts
        │
        ▼
FastAPI executes each call directly against Supabase (agent_tools.py),
logs it to agent_actions, feeds the result back to Gemini
        │
        ▼
Loop until Gemini stops calling tools (capped at 5 turns)
        │
        ▼
Response: { summary, actions: [{tool, args, result}] }  → rendered in
<AgentCommandBar/> as a live action feed, then the task board refreshes
```

The model is never allowed to just describe what it would do — the system
prompt in `gemini_client.py` forces tool calls for anything actionable, and
`agent_tools.py` is the only thing allowed to touch the DB.

## 5. API surface

| Method | Path                    | Purpose                                  |
|--------|--------------------------|-------------------------------------------|
| GET    | `/events`                | list events for a club                    |
| GET    | `/events/{id}`           | event + its tasks                         |
| POST   | `/events`                | manual event create (bypass agent)        |
| POST   | `/events/{id}/complete`  | leader marks event completed; 409 unless every task is done |
| GET    | `/tasks?event_id=`       | list tasks for an event                   |
| POST   | `/tasks`                 | leader creates a task (persisted)         |
| POST   | `/me/delete`             | delete your own account and profile (email must be typed to confirm; 409 if you're a club's only leader) |
| PATCH  | `/tasks/{id}`            | status / priority / assignee; members may only move their own task's status |
| POST   | `/agent/command`         | **the agent** — NL in, DB mutation out    |
| POST   | `/api/events/plan`       | queue a plan; returns `202 {job_id}`      |
| GET    | `/api/events/plan/{id}`  | poll a queued plan                        |
| POST   | `/api/feedback/submit`   | Gemini-validated feedback + rating        |
| DELETE | `/api/feedback/{id}`     | leader removes feedback; trigger re-averages |
| POST   | `/api/knowledge/query`   | pgvector retrieval, `grounded` false if nothing clears the floor |

Every route takes the club from the caller's verified JWT. Where a club id also
appears in a request body it is checked against the token and rejected on
mismatch — it is never trusted on its own.

## 6. Env vars

Backend (`backend/.env`) — see `backend/.env.example` for the full annotated
list. Every value is validated at import time in `app/config.py`, so a bad or
missing one fails the boot rather than the first request:

```
ENVIRONMENT=development          # "production" rejects localhost CORS + wildcard hosts
SUPABASE_URL=
SUPABASE_SERVICE_KEY=            # secret key; NEVER in Vercel, NEVER a NEXT_PUBLIC_* var
SUPABASE_JWKS_URL=               # required: auth cannot work without it
GEMINI_API_KEY=
CORS_ORIGINS=["http://localhost:3000"]
ALLOWED_HOSTS=["*"]              # set explicitly in production
```

## 7. Local setup

```bash
# 1. DB -- run in the Supabase SQL editor, IN THIS ORDER.
#   The migrations are not optional; 004 is what enforces tenant isolation.
#   supabase/schema.sql
#   supabase/seed.sql
#   supabase/migrations/002_auth_roles.sql
#   supabase/migrations/003_demo_auth_data.sql
#   supabase/migrations/004_tenant_rls.sql        <- club-scoped RLS
#   supabase/migrations/005_tenant_identity.sql   <- per-club emails + invites
#   supabase/migrations/006_integrity_and_jobs.sql
#   supabase/migrations/007_rag_thresholds.sql
#   supabase/migrations/008_signup_role_choice.sql  <- role picker at sign-up
#   supabase/migrations/009_account_deletion.sql    <- account deletion cascade + trigger fix

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --reload --port 8000

# 3. Frontend
cd frontend
npm install
cp .env.local.example .env.local   # fill in keys
npm run dev
```

## 8. Security posture (current — supersedes the old "demo shortcuts" note)

This section used to say "no auth, RLS bypassed, don't care for 48 hours."
That is no longer true, and the shortcuts it described have been removed.
Do not reintroduce them.

**Tenancy is enforced in two independent places, and needs both.**

1. **Postgres.** `supabase/migrations/004_tenant_rls.sql` anchors every RLS
   policy on `current_club_id()`. The browser holds the anon key and queries
   PostgREST directly, so this — not the frontend's `.eq("club_id", ...)`
   filters — is the control. Before 004 the policies were scoped by *role*
   only (`current_member_role() = 'leader'`), which is true for a leader of
   *any* club: one login could read every tenant's rows.

2. **FastAPI.** The backend talks to Postgres with the service key, which
   bypasses RLS entirely. Therefore *every* check must happen in `app/auth.py`
   (JWT verified against the project JWKS, asymmetric algorithms only, role
   read from the `members` table and never from the token) plus
   `app/services/access.py`. A foreign id returns 404, not 403, so ids cannot
   be probed.

**The agent is the sharpest edge in the system.** `/agent/command` feeds
attacker-controlled text ("paste your meeting notes") to a model that can write
to the database. So `app/services/agent_tools.py` accepts **no tenant
identifier as a tool argument** — club and event are bound per request from the
verified JWT via `bind_tenant()` and read from a ContextVar. Adding a `club_id`
or `event_id` parameter to a tool declaration re-opens cross-tenant writes via
prompt injection. `backend/tests/test_tenant_binding.py` guards this; run it
after touching that file.

**Known, accepted gap: self-elected leaders.**
`supabase/migrations/008_signup_role_choice.sql` lets the sign-up form choose
`leader` or `member`, read from `raw_user_meta_data` with **no verification**.
002 originally forbade exactly this. It was reinstated deliberately for the
demo, with the consequence understood: anyone who can reach `/signup` can
become a leader of the single club and read every member, task and feedback
row, delete feedback, and drive the agent's write tools. Three things still
override the form's choice server-side — an existing member row keeps its
role, a `club_invites` row outranks a self-claim, and the first account in a
club with no leader becomes the leader. Close the gap with a leader access
code, an approval step, or by reverting to 005; the banner at the top of 008
spells out all three. Do not treat this as settled design.

**Other invariants worth not breaking:**

- `SUPABASE_SERVICE_KEY` belongs only to the FastAPI host. It must never
  appear in Vercel or in any `NEXT_PUBLIC_*` variable.
- Untrusted text handed to Gemini is fenced in a per-request random delimiter
  (`app/services/feedback.py`); structured output constrains the *shape* of a
  verdict, never its *values*.
- RAG retrieval has a cosine floor (`MIN_SIMILARITY`). An empty result is a
  valid answer meaning "not grounded" — never fall back to the nearest
  unrelated chunk.
- Planning runs as a background job with polling, not inside the request. A
  ~45s Gemini call inside a request is dropped by any proxy in front of it.
- Both rate-limit layers are load-bearing; see the docstring in
  `app/limits.py` for why `SlowAPIMiddleware` is deliberately *not* installed.
- The agent loop is capped at `MAX_TOOL_TURNS` and reports `failed` and
  `truncated` counts. Partial writes must stay visible, not be smoothed over
  by the model's summary.
