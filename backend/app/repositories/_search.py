"""Shared helper for text search in repositories."""


def like_contains(q: str) -> str:
    """Turn a user's search text into a safe ILIKE "contains" pattern.

    The wildcards in LIKE/ILIKE are % (any run) and _ (any single char). If we
    dropped the user's text straight into a pattern, a search for "a_b" or "50%"
    would be read as wildcards. We escape the backslash first (the default LIKE
    escape char), then % and _, so the user's text is matched literally and only
    the % we add around it do any wildcarding.
    """
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
