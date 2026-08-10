"""
Lakebase database helper for the AI Trip & Outdoor Activity Planner.

The connection URL is retrieved securely from a Databricks secret.
"""

import base64
import os
from contextlib import contextmanager

import psycopg2
from databricks.sdk import WorkspaceClient
from psycopg2.extras import RealDictCursor


_workspace = WorkspaceClient()

_SECRET_SCOPE = os.environ.get(
    "LAKEBASE_SECRET_SCOPE",
    "database"
)

_SECRET_KEY = os.environ.get(
    "LAKEBASE_SECRET_KEY",
    "lakebase-url"
)


def _get_connection_url() -> str:
    """Retrieve and decode the Lakebase connection URL."""
    secret = _workspace.secrets.get_secret(
        scope=_SECRET_SCOPE,
        key=_SECRET_KEY
    )

    return base64.b64decode(secret.value).decode("utf-8")


@contextmanager
def get_connection():
    """
    Open a Lakebase connection and close it automatically.
    Rows are returned as dictionaries.
    """
    connection = psycopg2.connect(
        _get_connection_url(),
        cursor_factory=RealDictCursor
    )

    try:
        yield connection
    finally:
        connection.close()


def fetch_all(sql: str, params=None) -> list[dict]:
    """Execute a SELECT query and return all rows."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def fetch_one(sql: str, params=None):
    """Execute a SELECT query and return one row."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchone()


def execute(sql: str, params=None) -> int:
    """
    Execute an INSERT, UPDATE, or DELETE statement.

    Returns the number of affected rows.
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            affected_rows = cursor.rowcount
            connection.commit()

            return affected_rows


def execute_returning(sql: str, params=None):
    """
    Execute an INSERT/UPDATE statement that contains RETURNING
    and return the resulting row.
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            result = cursor.fetchone()
            connection.commit()

            return result
