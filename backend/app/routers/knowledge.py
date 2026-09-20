from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.gemini import GeminiError
from app.services.rag import search_documents

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KnowledgeQuery(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    club_id: UUID | None = None  # None = search every club
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


@router.post("/query", response_model=KnowledgeResponse)
def query_knowledge(body: KnowledgeQuery):
    """Embed the query and return the closest club-document chunks (pgvector cosine).
    Pure retrieval: no text generation."""
    try:
        matches = search_documents(
            body.query, top_k=body.top_k, club_id=str(body.club_id) if body.club_id else None
        )
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return KnowledgeResponse(
        query=body.query,
        context="\n\n---\n\n".join(m["content"] for m in matches),
        matches=matches,
    )
