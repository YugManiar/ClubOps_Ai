# Club knowledge base

Drop your club's documents here (`.md` or `.txt`, subfolders are fine): past
event retros, budgets, vendor lists, checklists, meeting notes.

Then, from `backend/`:

```bash
python -m app.services.rag            # ingests everything in knowledge/
python -m app.services.rag path/to/file.md --club-id <uuid>
```

Each file is split into ~1000-character chunks, embedded with Gemini
(768 dimensions) and stored in the `club_documents` table. Re-running replaces a
file's old chunks, so it is safe to run again after editing. This README is
skipped.

Query it: `POST /api/knowledge/query` with `{"query": "...", "top_k": 5}`.
