from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agent, events, feedback, knowledge, planning, tasks

app = FastAPI(title="ClubOps AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(tasks.router)
app.include_router(agent.router)
app.include_router(planning.router)
app.include_router(feedback.router)
app.include_router(knowledge.router)


@app.get("/health")
def health():
    return {"status": "ok"}
