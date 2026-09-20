"""
Apply a SQL file to the Supabase Postgres directly.

The service key only reaches PostgREST, which cannot run DDL, so migrations
need a real Postgres connection. Get the string from:
  Supabase Dashboard -> Project Settings -> Database -> Connection string
  -> "URI" tab (use the Session pooler / port 5432 form).

Provide it either way -- the file is gitignored, which keeps the password out
of your shell history:

  echo 'postgresql://postgres.<ref>:<password>@<host>:5432/postgres' > supabase/.dbconn
  python supabase/run_migrations.py supabase/migrations/RUN_ALL_004_to_008.sql

  # or
  SUPABASE_DB_URL='postgresql://...' python supabase/run_migrations.py <file.sql>

Runs the whole file in ONE transaction: if any statement fails, nothing is
applied and you can fix and re-run. Every migration here is idempotent.
"""

import os
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent


def connection_string() -> str:
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if url:
        return url
    dotfile = HERE / ".dbconn"
    if dotfile.exists():
        url = dotfile.read_text(encoding="utf-8").strip()
        if url:
            return url
    sys.exit(
        "No connection string. Set SUPABASE_DB_URL or write it to supabase/.dbconn\n"
        "(Dashboard -> Project Settings -> Database -> Connection string -> URI)"
    )


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit(f"usage: python {Path(__file__).name} <file.sql>")

    sql_path = Path(sys.argv[1])
    sql = sql_path.read_text(encoding="utf-8")
    print(f"Applying {sql_path.name} ({len(sql.splitlines())} lines)...")

    # autocommit=False -> psycopg opens a transaction; commit only on success.
    with psycopg.connect(connection_string(), autocommit=False) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
            except psycopg.Error as e:
                conn.rollback()
                print(f"\nFAILED -- nothing was applied.\n  {e}", file=sys.stderr)
                return 1
        conn.commit()
        print("Committed.\n")

        # Report the resulting state rather than claiming success blindly.
        with conn.cursor() as cur:
            cur.execute("select email, role from members order by role desc, email")
            print("members:")
            for email, role in cur.fetchall():
                print(f"  {email:34} {role}")

            cur.execute(
                "select tablename from pg_tables where schemaname = 'public' "
                "and tablename in ('club_invites','plan_jobs') order by tablename"
            )
            print("\nnew tables:", [r[0] for r in cur.fetchall()] or "NONE")

            cur.execute(
                "select tablename, policyname from pg_policies "
                "where schemaname = 'public' order by tablename, policyname"
            )
            print("\nRLS policies:")
            for table, policy in cur.fetchall():
                print(f"  {table:16} {policy}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
