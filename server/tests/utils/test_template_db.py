"""Tests for template DB utility helpers."""

from pathlib import Path

from app.utils.template_db import compute_db_hash, get_admin_url


def test_get_admin_url_replaces_database_name():
    assert (
        get_admin_url("postgresql://user:pass@localhost:5432/appdb")
        == "postgresql://user:pass@localhost:5432/postgres"
    )


def test_compute_db_hash_changes_when_sql_inputs_change(tmp_path):
    database_dir = tmp_path / "database"
    schema_dir = database_dir / "schema" / "tables"
    schema_dir.mkdir(parents=True)
    (schema_dir / "a.sql").write_text("CREATE TABLE a();", encoding="utf-8")
    (database_dir / "test-seed.sql").write_text("INSERT INTO a VALUES (1);", encoding="utf-8")

    sql_dir = tmp_path / "sql"
    query_dir = sql_dir / "queries"
    query_dir.mkdir(parents=True)
    (query_dir / "q.sql").write_text("SELECT 1;", encoding="utf-8")

    first = compute_db_hash(database_dir, sql_dir)

    (query_dir / "q.sql").write_text("SELECT 2;", encoding="utf-8")
    second = compute_db_hash(database_dir, sql_dir)

    assert len(first) == 16
    assert len(second) == 16
    assert first != second


def test_compute_db_hash_includes_relative_paths(tmp_path):
    database_dir = tmp_path / "database"
    (database_dir / "schema").mkdir(parents=True)
    (database_dir / "test-seed.sql").write_text("-- seed", encoding="utf-8")

    sql_dir = tmp_path / "sql"
    first_dir = sql_dir / "alpha"
    first_dir.mkdir(parents=True)
    (first_dir / "same.sql").write_text("SELECT 1;", encoding="utf-8")

    first = compute_db_hash(database_dir, sql_dir)

    second_dir = sql_dir / "beta"
    second_dir.mkdir(parents=True)
    (second_dir / "same.sql").write_text("SELECT 1;", encoding="utf-8")
    (first_dir / "same.sql").unlink()

    second = compute_db_hash(database_dir, sql_dir)

    assert first != second

