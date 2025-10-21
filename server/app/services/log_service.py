"""Log service with business logic and dynamic SQL."""

import json
from datetime import UTC, datetime
from typing import Any, cast

import asyncpg  # type: ignore

from app.cache import keys
from app.queries.log_queries import LogQueries
from app.schemas.logs import (
    ActorData,
    BulkDeleteLogsRequest,
    BulkDeleteLogsResponse,
    ContextData,
    CreateLogRequest,
    CreateLogResponse,
    ErrorData,
    LogItem,
    LogsListRequest,
    LogsListResponse,
    SubjectData,
)
from app.services.base_service import BaseService, with_cache


class LogService(BaseService):
    """Service for log operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = LogQueries()

    def _parse_jsonb_to_model(
        self,
        data: Any,
        model_class: type[ActorData]
        | type[SubjectData]
        | type[ContextData]
        | type[ErrorData],
    ) -> ActorData | SubjectData | ContextData | ErrorData:
        """
        Parse JSONB data to Pydantic model.

        Args:
            data: JSONB data (should always be a dict since columns are NOT NULL)
            model_class: Pydantic model class to parse into

        Returns:
            Parsed model instance (never None since DB columns are NOT NULL with defaults)
        """
        if isinstance(data, dict):
            return model_class(**data)
        # Defensive: if data is somehow None or invalid, return empty model
        return model_class()

    @with_cache(lambda self, request: keys.log_list())
    async def get_logs_list(self, request: LogsListRequest) -> LogsListResponse:
        """
        Get list of logs with actor information and all JSONB fields.

        Args:
            request: List request

        Returns:
            LogsListResponse
        """
        query, params = self.queries.get_logs_list()
        rows = await self.conn.fetch(query, *params)
        return self._build_logs_list_response(rows)

    def _build_logs_list_response(self, rows: list[Any]) -> LogsListResponse:
        """Build LogsListResponse from database rows."""
        log_items: list[LogItem] = []
        for row in rows:
            log_items.append(
                LogItem(
                    log_id=row["log_id"],
                    event=row["event"],
                    level=row["level"],
                    message=row["message"],
                    correlation_id=row["correlation_id"],
                    actor=cast(
                        ActorData, self._parse_jsonb_to_model(row["actor"], ActorData)
                    ),
                    subject=cast(
                        SubjectData,
                        self._parse_jsonb_to_model(row["subject"], SubjectData),
                    ),
                    context=cast(
                        ContextData,
                        self._parse_jsonb_to_model(row["context"], ContextData),
                    ),
                    error=cast(
                        ErrorData, self._parse_jsonb_to_model(row["error"], ErrorData)
                    ),
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    actor_name=row["actor_name"],
                )
            )

        return LogsListResponse(logs=log_items)

    async def create_log(self, request: CreateLogRequest) -> CreateLogResponse:
        """
        Create a new log entry.

        Args:
            request: Create request

        Returns:
            CreateLogResponse
        """

        # Helper to ensure JSON-serializable values with defaults
        def ensure_json(value: Any, default: dict[str, Any]) -> dict[str, Any]:
            if value is None or not isinstance(value, dict):
                return default
            try:
                # Verify it's JSON-serializable
                json.dumps(value)
                return cast(dict[str, Any], value)
            except (TypeError, ValueError):
                return default

        # Extract correlation_id from correlation object, use default if not provided
        correlation_id = "default.correlation"
        if request.correlation and request.correlation.correlationId:
            correlation_id = request.correlation.correlationId

        # Prepare JSONB fields with database-matching defaults
        actor_json = ensure_json(request.actor, {"userId": None, "profileId": None})
        subject_json = ensure_json(
            request.subject, {"entityId": None, "entityType": None}
        )
        context_json = ensure_json(
            request.context, {"route": None, "function": None, "component": None}
        )
        error_json = ensure_json(
            request.error, {"code": None, "name": None, "stack": None, "message": None}
        )

        # Insert log entry
        insert_query, _ = self.queries.insert_log()

        result = await self.conn.fetchrow(
            insert_query,
            request.event,
            request.level,
            request.message,
            correlation_id,
            json.dumps(actor_json),
            json.dumps(subject_json),
            json.dumps(context_json),
            json.dumps(error_json),
            datetime.now(UTC),
        )

        log_id = result["id"] if result else None

        # Invalidate log caches
        await self._invalidate_cache([keys.tag_log_all()])

        return CreateLogResponse(success=True, log_id=log_id)

    @with_cache(lambda self, level="error", limit=100: keys.log_recent(level, limit))
    async def get_recent_logs(
        self, level: str = "error", limit: int = 100
    ) -> list[dict[str, Any]]:
        """
        Get recent application logs filtered by level.

        Args:
            level: Log level filter (or "all" for no filtering)
            limit: Maximum number of logs to return

        Returns:
            List of log dictionaries with formatted data
        """
        query, params = self.queries.get_recent_logs(level, limit)
        rows = await self.conn.fetch(query, *params)
        return self._build_recent_logs_response(rows)

    def _build_recent_logs_response(self, rows: list[Any]) -> list[dict[str, Any]]:
        """Build recent logs response from database rows."""
        return [
            {
                "id": row["id"],
                "level": row["level"],
                "message": row["message"],
                "context": row["context"],
                "created_at": row["created_at"].isoformat()
                if row["created_at"]
                else None,
            }
            for row in rows
        ]

    async def bulk_delete_logs(
        self, request: BulkDeleteLogsRequest
    ) -> BulkDeleteLogsResponse:
        """
        Delete multiple logs. Only superadmin can delete logs.

        Args:
            request: Bulk delete request with profileId and log IDs

        Returns:
            BulkDeleteLogsResponse with deleted count

        Raises:
            ValueError: If profile not found
            PermissionError: If user is not superadmin
        """
        # Check if user is superadmin
        query, params = self.queries.check_profile_role(request.profileId)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Profile not found: {request.profileId}")

        if result["role"] != "superadmin":
            raise PermissionError("Only superadmin users can delete logs")

        if not request.ids:
            return BulkDeleteLogsResponse(
                success=True, deleted_count=0, message="No logs to delete"
            )

        # Delete logs
        query, params = self.queries.delete_logs_bulk(request.ids)
        deleted_rows = await self.conn.fetch(query, *params)
        deleted_count = len(deleted_rows)

        # Invalidate log caches
        await self._invalidate_cache([keys.tag_log_all()])

        return BulkDeleteLogsResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} log(s)",
        )


def get_log_service(conn: asyncpg.Connection) -> LogService:
    """Get log service instance."""
    return LogService(conn)
