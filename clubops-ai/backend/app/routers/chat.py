from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag import search_documents

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    """
    Embeds the query, runs a pgvector similarity search over club_documents,
    and returns the matching historical context (no LLM generation).
    """
    try:
        matches = search_documents(
            payload.query,
            top_k=payload.top_k,
            club_id=str(payload.club_id) if payload.club_id else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Retrieval failed: {exc}")

    return ChatResponse(
        query=payload.query,
        context="\n\n---\n\n".join(m["content"] for m in matches),
        matches=matches,
    )
