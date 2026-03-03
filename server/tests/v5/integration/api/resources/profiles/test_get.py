"""Integration tests for resource profiles get endpoint.

Profiles GET has no HTTP route — only internal function.
The profiles types (QGetProfilesV4Item etc.) are not in the auto-generated
types.py, so internal function tests are skipped.
"""

import pytest

pytestmark = pytest.mark.asyncio


class TestGetProfilesInternal:
    """Tests for get_profiles_internal function.

    Profiles types are not auto-generated in types.py, so we cannot
    import the internal function. The profiles GET is verified
    indirectly through other artifact endpoints that use it.
    """

    async def test_placeholder(self) -> None:
        """Placeholder — profiles GET is internal-only with handcrafted types."""
        pass
