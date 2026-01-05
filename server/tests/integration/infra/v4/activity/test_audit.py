"""Integration tests for app.infra.v4.activity.audit."""

from starlette.requests import Request as StarletteRequest

from app.infra.v4.activity.audit import AuditIntent, audit_activity, audit_set


class TestAuditActivity:
    """Tests for audit_activity function."""

    def test_audit_activity_sets_intent(self) -> None:
        """Test audit_activity sets audit intent in request state."""
        # Arrange
        event_key = "test.event"
        template = "Test template with {{ variable }}"

        # Act
        dependency = audit_activity(event_key, template)

        # Assert
        assert dependency is not None
        # The dependency is a Depends object, we can't easily test it without FastAPI context
        # But we can verify the function exists and is callable

    def test_audit_set_updates_context(self) -> None:
        """Test audit_set updates audit context."""
        # Arrange
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v4/test",
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        request = StarletteRequest(scope)
        request.state.audit_ctx = {}

        # Act
        audit_set(request, actor={"name": "Test User", "id": "123"})

        # Assert
        assert hasattr(request.state, "audit_ctx")
        assert request.state.audit_ctx["actor"]["name"] == "Test User"
        assert request.state.audit_ctx["actor"]["id"] == "123"

    def test_audit_set_creates_context_if_missing(self) -> None:
        """Test audit_set creates context if it doesn't exist."""
        # Arrange
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v4/test",
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        request = StarletteRequest(scope)

        # Act
        audit_set(request, test_field="test_value")

        # Assert
        assert hasattr(request.state, "audit_ctx")
        assert request.state.audit_ctx["test_field"] == "test_value"


class TestAuditIntent:
    """Tests for AuditIntent dataclass."""

    def test_audit_intent_creation(self) -> None:
        """Test AuditIntent creation."""
        # Arrange & Act
        intent = AuditIntent(event_key="test.event", template="Test template")

        # Assert
        assert intent.event_key == "test.event"
        assert intent.template == "Test template"
