from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent, chat, events, tasks

app = FastAPI(title="ClubOps AI")

# Hackathon CORS: wide open. Lock this down before it's ever anywhere but localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(tasks.router)
app.include_router(agent.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
