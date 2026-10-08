from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """One shared pool of database connections, created on first use."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            settings.database_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
            timeout=5,  # fail fast if the database is unreachable
            # Test a connection before handing it out. On Lambda the process is frozen
            # between requests and the database may have closed idle connections, so
            # this quietly swaps a dead one for a fresh one instead of failing a request.
            check=ConnectionPool.check_connection,
            kwargs={
                "row_factory": dict_row,
                # Hosted databases (Neon, RDS Proxy) often sit behind a pooler that
                # cannot keep prepared statements; turning them off is safe everywhere.
                "prepare_threshold": None,
            },
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
