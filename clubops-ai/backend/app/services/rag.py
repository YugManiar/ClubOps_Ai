"""
RAG utilities: chunk text, embed with Gemini, store/search in Supabase
(club_documents table + match_club_documents SQL function).

CLI ingest:
    python -m app.services.rag path/to/notes.txt [--club-id UUID] [--source NAME]
"""

import argparse
from pathlib import Path
from typing import Optional

import google.generativeai as genai

from app.config import settings
from app.db import supabase

genai.configure(api_key=settings.gemini_api_key)

CHUNK_SIZE = 1000  # characters
CHUNK_OVERLAP = 150
EMBED_BATCH_SIZE = 100  # Gemini batchEmbedContents limit
INSERT_BATCH_SIZE = 100

_SEPARATORS = ("\n\n", "\n", ". ", " ")


def chunk_text(
    text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """Split text into ~chunk_size-char chunks, preferring paragraph/sentence
    boundaries, with `overlap` chars carried between neighbours."""
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")
    text = text.strip()
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            window = text[start:end]
            for sep in _SEPARATORS:
                # Only break in the back half so chunks don't get tiny.
                cut = window.rfind(sep, chunk_size // 2)
                if cut != -1:
                    end = start + cut + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _embed(content: str | list[str], task_type: str) -> list[list[float]]:
    result = genai.embed_content(
        model=settings.gemini_embedding_model,
        content=content,
        task_type=task_type,
        output_dimensionality=settings.embedding_dim,
    )
    embedding = result["embedding"]
    # A single string returns one vector; a list returns a list of vectors.
    return [embedding] if isinstance(content, str) else embedding


def embed_documents(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        vectors.extend(
            _embed(texts[i : i + EMBED_BATCH_SIZE], "retrieval_document")
        )
    return vectors


def embed_query(query: str) -> list[float]:
    return _embed(query, "retrieval_query")[0]


def ingest_document(
    text: str,
    source: str,
    club_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    """Chunk, embed and insert one document. Returns the number of chunks stored."""
    chunks = chunk_text(text)
    if not chunks:
        return 0
    vectors = embed_documents(chunks)

    rows = [
        {
            "club_id": club_id,
            "source": source,
            "chunk_index": i,
            "content": chunk,
            "metadata": metadata or {},
            "embedding": vector,
        }
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    for i in range(0, len(rows), INSERT_BATCH_SIZE):
        supabase.table("club_documents").insert(rows[i : i + INSERT_BATCH_SIZE]).execute()
    return len(rows)


def search_documents(
    query: str, top_k: int = 5, club_id: Optional[str] = None
) -> list[dict]:
    """Embed the query and return the top_k most similar chunks."""
    response = supabase.rpc(
        "match_club_documents",
        {
            "query_embedding": embed_query(query),
            "match_count": top_k,
            "match_club_id": club_id,
        },
    ).execute()
    return response.data or []


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest a text file into club_documents")
    parser.add_argument("path", type=Path)
    parser.add_argument("--club-id")
    parser.add_argument("--source")
    args = parser.parse_args()

    count = ingest_document(
        args.path.read_text(encoding="utf-8"),
        source=args.source or args.path.name,
        club_id=args.club_id,
    )
    print(f"Stored {count} chunks from {args.path}")
