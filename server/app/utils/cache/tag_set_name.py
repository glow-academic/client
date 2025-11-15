"""Get Redis set name for a tag."""

TAG_SET_PREFIX = "http:tag:"


def tag_set_name(tag: str) -> str:
    """Get Redis set name for a tag."""
    return f"{TAG_SET_PREFIX}{tag}"
