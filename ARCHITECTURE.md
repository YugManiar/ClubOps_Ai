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
| GET    | `/tasks?event_id=`       | list tasks for an event                   |
| PATCH  | `/tasks/{id}`            | manual status update                      |
| POST   | `/agent/command`         | **the agent** — NL in, DB mutation out    |

## 6. Env vars

Backend (`backend/.env`):
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

Frontend (`frontend/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 7. Local setup

```bash
# 1. DB
#   paste supabase/schema.sql, then supabase/seed.sql into the Supabase SQL editor

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

## 8. Demo-day shortcuts already baked in

- Backend uses the Supabase **service-role** key → RLS is bypassed entirely.
  Do not ship this to prod, do not care about that for the next 48 hours.
- No auth flow scaffolded. If you need a login screen for the demo, fake a
  `current_member_id` in local state — don't build real auth this weekend.
- Agent loop is capped at 5 tool-call turns with no retry/backoff. If Gemini
  hallucinates a bad arg, it fails loud in the response — that's a feature
  for debugging on stage, not a bug to fix before Sunday.
