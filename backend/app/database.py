from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """One shared pool of database connections, created on first use."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            get_settings().database_url,
            min_size=1,
            max_size=10,
            timeout=5,  # fail fast if the database is unreachable
            kwargs={"row_factory": dict_row},
            open=False,
        )
        _pool.open()
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_db():
    """FastAPI dependency: one connection per request.

    Commits when the request succeeds, rolls back if anything raises.
    """
    with get_pool().connection() as conn:
        yield conn
