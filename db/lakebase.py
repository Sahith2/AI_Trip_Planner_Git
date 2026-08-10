"""
Lakebase connection helper for the AI Trip & Outdoor Activity Planner.

Uses the Databricks App's Lakebase resource and OAuth authentication.
No database password or connection string is stored in GitHub.
"""

import os
from contextlib import contextmanager

import psycopg2
from databricks.sdk import WorkspaceClient
from psycopg2.extras import RealDictCursor


# ------------------------------------------------------------
# Databricks workspace client
# ------------------------------------------------------------

_workspace = WorkspaceClient()


# ------------------------------------------------------------
# Lakebase endpoint
# ------------------------------------------------------------

# This must be the Lakebase endpoint associated with the
# database resource used by the Databricks App.
#
# We will set this as an App environment variable.
_ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME")


# ------------------------------------------------------------
# Create a fresh OAuth database credential
# ------------------------------------------------------------

def _get_database_token() -> str:
    """
    Generate a fresh OAuth credential for Lakebase.

    Databricks Lakebase OAuth credentials are short-lived,
    so we generate a new credential whenever a connection
    is opened.
    """

    if not _ENDPOINT_NAME:
        raise RuntimeError(
            "LAKEBASE_ENDPOINT_NAME environment variable "
            "is not configured."
        )

    credential = _workspace.postgres.generate_database_credential(
        endpoint=_ENDPOINT_NAME
    )

    return credential.token


# ------------------------------------------------------------
# Open Lakebase connection
# ------------------------------------------------------------

@contextmanager
def get_connection():
    """
    Open a Lakebase PostgreSQL connection.

    Databricks App automatically provides:
        PGHOST
        PGDATABASE
        PGPORT
        PGUSER
        PGSSLMODE

    A fresh OAuth token is generated for authentication.
    """

    host = os.environ["PGHOST"]
    database = os.environ["PGDATABASE"]
    user = os.environ["PGUSER"]

    port = os.environ.get(
        "PGPORT",
        "5432"
    )

    sslmode = os.environ.get(
        "PGSSLMODE",
        "require"
    )

    password = _get_database_token()

    connection = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        sslmode=sslmode,
        cursor_factory=RealDictCursor,
    )

    try:
        yield connection

    finally:
        connection.close()


# ------------------------------------------------------------
# SELECT - multiple rows
# ------------------------------------------------------------

def fetch_all(
    sql: str,
    params=None
) -> list[dict]:
    """
    Execute a SELECT query and return all rows.
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                sql,
                params
            )

            return cursor.fetchall()


# ------------------------------------------------------------
# SELECT - one row
# ------------------------------------------------------------

def fetch_one(
    sql: str,
    params=None
):
    """
    Execute a SELECT query and return one row.
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                sql,
                params
            )

            return cursor.fetchone()


# ------------------------------------------------------------
# INSERT / UPDATE / DELETE
# ------------------------------------------------------------

def execute(
    sql: str,
    params=None
) -> int:
    """
    Execute an INSERT, UPDATE, or DELETE statement.

    Returns the number of affected rows.
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                sql,
                params
            )

            affected_rows = cursor.rowcount

            connection.commit()

            return affected_rows


# ------------------------------------------------------------
# INSERT / UPDATE with RETURNING
# ------------------------------------------------------------

def execute_returning(
    sql: str,
    params=None
):
    """
    Execute an INSERT or UPDATE statement containing
    RETURNING and return the resulting row.
    """

    with get_connection() as connection:

        with connection.cursor() as cursor:

            cursor.execute(
                sql,
                params
            )

            result = cursor.fetchone()

            connection.commit()

            return result
