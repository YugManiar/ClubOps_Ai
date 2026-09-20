import logging
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.auth import jwks_client
from app.config import settings
from app.db import supabase
from app.limits import GlobalRateLimitMiddleware, limiter
from app.routers import agent, events, feedback, knowledge, planning, tasks

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def _preflight() -> None:
    """Assert the deploy's contract with its dependencies.

    Everything here is config, not traffic: if one of these is wrong the service
    can never serve a real request, so it must never report itself healthy.
    """
    # 1. JWKS reachable and parseable. Without this every authenticated request
    #    raises from inside auth.py and surfaces as an opaque 500.
    jwks_client().fetch_data()
    log.info("JWKS reachable")

    # 2. The service key actually works and bypasses RLS.
    supabase.table("clubs").select("id").limit(1).execute()
    log.info("Supabase service key accepted")

    # 3. The embedding model's output width must match club_documents.embedding
    #    vector(768). A mismatch corrupts every ingested row silently.
    from app.services.rag import embed_query  # imported late: pulls in google-genai

    try:
        dim = len(embed_query("startup dimension check"))
    except Exception:  # a Gemini blip must not block a deploy
        log.warning("could not verify embedding dimension at startup", exc_info=True)
    else:
        if dim != settings.embedding_dim:
            raise RuntimeError(
                f"{settings.gemini_embedding_model} returns {dim} dims, "
                f"but the schema expects {settings.embedding_dim}"
            )
        log.info("embedding dimension %d confirmed", dim)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync `def` endpoints run here; the Supabase and Gemini clients block. The
    # default of 40 is thin once background plan jobs share the pool.
    anyio.to_thread.current_default_thread_limiter().total_tokens = 80
    _preflight()
    yield


app = FastAPI(title="ClubOps AI", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Starlette runs the most recently added middleware outermost, so CORS is added
# last: every response, including a 429 or a rejected host, carries CORS headers
# and the browser can read the real status instead of an opaque network error.
#
# Note there is deliberately no SlowAPIMiddleware here -- it is a no-op against
# routes registered via include_router in this FastAPI version. See app/limits.py.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(GlobalRateLimitMiddleware, exempt_paths=frozenset({"/health"}))
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    # Auth is a Bearer header, not a cookie. Keeping this False means a
    # malicious origin cannot ride an ambient session even if it reaches us.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

app.include_router(events.router)
app.include_router(tasks.router)
app.include_router(agent.router)
app.include_router(planning.router)
app.include_router(feedback.router)
app.include_router(knowledge.router)


@app.get("/health")
def health():
    """Exempt from the global ceiling (see exempt_paths above) so load-balancer
    probes never consume a caller's budget."""
    return {"status": "ok"}
