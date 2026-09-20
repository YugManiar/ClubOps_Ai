"""
Regression test: a rate-limited endpoint must still work when it SUCCEEDS.

slowapi with headers_enabled=True raises on the happy path unless the endpoint
declares a `response: Response` parameter -- so every limited AI route 500'd on
a good request while passing every test that only looked at 401/404/429. This
drives the success path of a real limited route, then confirms the limit still
trips.

    cd backend
    python tests/test_rate_limit_success.py
"""

import logging
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
logging.disable(logging.CRITICAL)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app.auth import CurrentUser, get_current_user  # noqa: E402
from app.routers import knowledge  # noqa: E402

user = CurrentUser(auth_user_id=UUID(int=1), member_id=UUID(int=2),
                   club_id=UUID(int=3), role="member", full_name="T")
main.app.dependency_overrides[get_current_user] = lambda: user
knowledge.search_documents = lambda *a, **k: []  # no Gemini, no network

client = TestClient(main.app)
failures = []


def check(label, ok):
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        failures.append(label)


codes = [client.post("/api/knowledge/query", json={"query": "refund policy"}).status_code
         for _ in range(32)]  # budget is 30/minute

check("limited endpoint returns 200 on a successful call", codes[0] == 200)
check("first 30 calls succeed (no 500 from header injection)", codes[:30] == [200] * 30)
check("the 31st call is rate limited", codes[30] == 429)

print("\nFAILURES:", failures or "none")
sys.exit(1 if failures else 0)
