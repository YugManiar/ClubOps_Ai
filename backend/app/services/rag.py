"""
RAG pipeline: chunk text, embed with Gemini, store/search in Supabase
(club_documents table + match_club_documents SQL function, pgvector cosine).

Ingest CLI (a single file or a whole folder of .md/.txt, run from backend/):
    python -m app.services.rag knowledge/
    python -m app.services.rag knowledge/retro.md --club-id <uuid>
"""

import argparse
from pathlib import Path

from google.genai import types

from app.config import settings
from app.db import supabase
from app.services.gemini import GeminiError, embed_with_retry

CHUNK_SIZE = 1000  # characters
CHUNK_OVERLAP = 150
# Cosine floor below which a chunk is treated as irrelevant rather than as the
# best available answer. Mirrors the default in match_club_documents (007);
# tune against the real corpus before launch.
MIN_SIMILARITY = 0.6
EMBED_BATCH_SIZE = 100  # Gemini batch embedding limit
INSERT_BATCH_SIZE = 100
SUPPORTED_SUFFIXES = {".md", ".txt"}

_SEPARATORS = ("\n\n", "\n", ". ", " ")


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
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


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    try:
        result = embed_with_retry(
            model=settings.gemini_embedding_model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type, output_dimensionality=settings.embedding_dim
            ),
        )
    except Exception as e:
        raise GeminiError(f"Embedding request failed: {e}") from e
    vectors = [list(e.values) for e in result.embeddings]
    if len(vectors) != len(texts):
        raise GeminiError(f"Expected {len(texts)} embeddings, got {len(vectors)}")
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        vectors.extend(_embed(texts[i : i + EMBED_BATCH_SIZE], "RETRIEVAL_DOCUMENT"))
    return vectors


def embed_query(query: str) -> list[float]:
    return _embed([query], "RETRIEVAL_QUERY")[0]


def ingest_document(
    text: str, source: str, club_id: str | None = None, metadata: dict | None = None
) -> int:
    """Chunk, embed and store one document. Re-ingesting the same (club, source)
    replaces its old chunks instead of duplicating them. Returns chunks stored."""
    chunks = chunk_text(text)
    if not chunks:
        return 0
    vectors = embed_documents(chunks)  # embed first: a failure leaves old chunks intact

    old = supabase.table("club_documents").delete().eq("source", source)
    (old.eq("club_id", club_id) if club_id else old.is_("club_id", "null")).execute()

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


def ingest_path(path: Path, club_id: str | None) -> dict[str, int]:
    """Ingest one file or every .md/.txt under a folder. Returns {source: chunks}."""
    if path.is_dir():
        files = sorted(f for f in path.rglob("*") if f.suffix.lower() in SUPPORTED_SUFFIXES)
        root = path
    elif path.is_file():
        files, root = [path], path.parent
    else:
        raise FileNotFoundError(path)

    return {
        (source := f.relative_to(root).as_posix()): ingest_document(
            f.read_text(encoding="utf-8"), source=source, club_id=club_id, metadata={"filename": f.name}
        )
        for f in files
        if f.name.lower() != "readme.md"
    }


def search_documents(query: str, top_k: int = 5, club_id: str | None = None) -> list[dict]:
    """Embed the query and return the top_k most similar chunks (cosine) from
    one club, dropping anything below MIN_SIMILARITY.

    An empty list is a valid, meaningful answer: it means the corpus has nothing
    relevant. Callers must treat it as "no grounding" and refuse to generate,
    never as "retrieval failed" -- returning the nearest unrelated chunks is how
    a RAG system produces a confident hallucination with a citation attached.
    """
    if not club_id:
        # No wildcard search. Passing None used to query every tenant's corpus.
        raise ValueError("club_id is required for document search")
    response = supabase.rpc(
        "match_club_documents",
        {
            "query_embedding": embed_query(query),
            "match_count": top_k,
            "match_club_id": club_id,
            "min_similarity": MIN_SIMILARITY,
        },
    ).execute()
    return response.data or []


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest .md/.txt files into club_documents")
    parser.add_argument("path", type=Path, nargs="?", default=Path("knowledge"))
    # Required: documents are tenant data, and there is no safe default club.
    parser.add_argument("--club-id", default=settings.default_club_id,
                        required=settings.default_club_id is None)
    args = parser.parse_args()

    results = ingest_path(args.path, args.club_id)
    for source, n in results.items():
        print(f"{n:>3} chunks  {source}")
    print(f"Ingested {len(results)} file(s), {sum(results.values())} chunks total")
