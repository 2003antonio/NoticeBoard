import threading
import time
from collections import defaultdict, deque

from app.config import get_settings
from app.core.errors import AppError


class FailedAttemptLimiter:
    """Blocks a client after too many FAILED attempts in a time window.

    Kept in memory, which is fine for one server. With several servers behind a
    load balancer, move this to Redis or the API gateway.
    """

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._failures: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _recent(self, key: str) -> deque:
        q = self._failures[key]
        cutoff = time.monotonic() - self.window
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def check(self, key: str) -> None:
        with self._lock:
            if len(self._recent(key)) >= self.limit:
                raise AppError(429, "Too many failed attempts, try again later")

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._recent(key).append(time.monotonic())

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()


_settings = get_settings()
login_limiter = FailedAttemptLimiter(_settings.login_rate_limit, _settings.login_rate_window_seconds)
