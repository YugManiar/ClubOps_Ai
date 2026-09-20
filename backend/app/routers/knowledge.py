from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.limits import limiter
from app.services.gemini import GeminiError
from app.services.rag import MIN_SIMILARITY, search_documents

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KnowledgeQuery(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class DocumentMatch(BaseModel):
    id: UUID
    source: str
    chunk_index: int
    content: str
    metadata: dict[str, Any] = {}
    similarity: float  # cosine similarity, 1.0 = identical


class KnowledgeResponse(BaseModel):
    query: str
    context: str  # matches joined, ready to drop into a prompt
    matches: list[DocumentMatch]
    #: False when nothing in the club's corpus cleared MIN_SIMILARITY. Callers
    #: MUST NOT generate an answer from `context` when this is false -- there is
    #: nothing in it to ground on, and the honest response is "I don't know".
    grounded: bool
    min_similarity: float = MIN_SIMILARITY


@router.post("/query", response_model=KnowledgeResponse)
@limiter.limit("30/minute")  # one embedding call per query
def query_knowledge(
    request: Request,  # required by slowapi
    body: KnowledgeQuery,
    user: CurrentUser = Depends(get_current_user),
):
    """Embed the query and return the closest chunks (pgvector cosine) from the
    caller's own club only, above the relevance floor. Pure retrieval: no text
    generation.

    An empty result is a successful response with grounded=false, not an error.
    """
    try:
        matches = search_documents(body.query, top_k=body.top_k, club_id=str(user.club_id))
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not matches:
        return KnowledgeResponse(query=body.query, context="", matches=[], grounded=False)

    return KnowledgeResponse(
        query=body.query,
        context="\n\n---\n\n".join(m["content"] for m in matches),
        matches=matches,
        grounded=True,
    )
