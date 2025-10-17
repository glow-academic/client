"""Log service with business logic and dynamic SQL."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, cast

import asyncpg  # type: ignore
from app.cache import keys
from app.extensions import get_query_client
from app.queries.log_queries import LogQueries
from app.schemas.logs import (ActorData, ContextData, CreateLogRequest,
                              CreateLogResponse, ErrorData, LogItem,
                              LogsListRequest, LogsListResponse, MetricsData,
                              SubjectData)


class LogService:
    """Service for log operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = LogQueries()

    def _parse_jsonb_to_model(
        self, data: Any, model_class: type
    ) -> Optional[Any]:
        """
        Parse JSONB data to Pydantic model.

        Args:
            data: JSONB data (can be dict, None, or any type)
            model_class: Pydantic model class to parse into

        Returns:
            Parsed model instance or None
        """
        if data is None:
            return None
        if isinstance(data, dict):
            return model_class(**data)
        return None

    async def get_logs_list(
        self, request: LogsListRequest
    ) -> LogsListResponse:
        """
        Get list of logs with actor information and all JSONB fields.

        Args:
            request: List request

        Returns:
            LogsListResponse
        """
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            query, params = self.queries.get_logs_list()
            rows = await self.conn.fetch(query, *params)
            return self._build_logs_list_response(rows)
        
        # Create cache key
        key = keys.log_list()
        
        # Define fetcher function
        async def fetcher() -> LogsListResponse:
            query, params = self.queries.get_logs_list()
            rows = await self.conn.fetch(query, *params)
            return self._build_logs_list_response(rows)
        
        # Query with cache
        return cast(
            LogsListResponse,
            await qc.query(
                key,
                fetcher,
                tags=list(key.tags()),
                fresh_ttl=30,
                stale_ttl=300
            )
        )
    
    def _build_logs_list_response(self, rows: List[Any]) -> LogsListResponse:
        """Build LogsListResponse from database rows."""
        log_items: List[LogItem] = []
        for row in rows:
            log_items.append(
                LogItem(
                    log_id=row['log_id'],
                    event=row['event'],
                    level=row['level'],
                    message=row['message'],
                    correlation_id=row['correlation_id'],
                    actor=self._parse_jsonb_to_model(row['actor'], ActorData),
                    subject=self._parse_jsonb_to_model(row['subject'], SubjectData),
                    metrics=self._parse_jsonb_to_model(row['metrics'], MetricsData),
                    context=self._parse_jsonb_to_model(row['context'], ContextData),
                    error=self._parse_jsonb_to_model(row['error'], ErrorData),
                    created_at=row['created_at'].isoformat()
                    if row['created_at']
                    else "",
                    actor_name=row['actor_name'],
                )
            )

        return LogsListResponse(logs=log_items)

    async def create_log(
        self, request: CreateLogRequest
    ) -> CreateLogResponse:
        """
        Create a new log entry.

        Args:
            request: Create request

        Returns:
            CreateLogResponse
        """
        # Helper to ensure JSON-serializable values
        def ensure_json(value: Any) -> Optional[Dict[str, Any]]:
            if value is None:
                return None
            if not isinstance(value, dict):
                return None
            try:
                # Verify it's JSON-serializable
                json.dumps(value)
                return value
            except (TypeError, ValueError):
                return None

        # Extract correlation_id from correlation object
        correlation_id = None
        if request.correlation:
            correlation_id = request.correlation.correlationId

        # Prepare JSONB fields
        actor_json = ensure_json(request.actor)
        subject_json = ensure_json(request.subject)
        metrics_json = ensure_json(request.metrics)
        context_json = ensure_json(request.context)
        error_json = ensure_json(request.error)

        # Insert log entry
        insert_query, _ = self.queries.insert_log()

        result = await self.conn.fetchrow(
            insert_query,
            request.event or "legacy.message",
            request.level or "info",
            request.message,
            correlation_id,
            json.dumps(actor_json) if actor_json else None,
            json.dumps(subject_json) if subject_json else None,
            json.dumps(metrics_json) if metrics_json else None,
            json.dumps(context_json) if context_json else None,
            json.dumps(error_json) if error_json else None,
            datetime.now(timezone.utc),
        )

        log_id = result['id'] if result else None

        # Invalidate log caches
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[
                keys.tag_log_all(),
            ])

        return CreateLogResponse(success=True, log_id=log_id)

    async def get_recent_logs(
        self, level: str = "error", limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recent application logs filtered by level.

        Args:
            level: Log level filter (or "all" for no filtering)
            limit: Maximum number of logs to return

        Returns:
            List of log dictionaries with formatted data
        """
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            query, params = self.queries.get_recent_logs(level, limit)
            rows = await self.conn.fetch(query, *params)
            return self._build_recent_logs_response(rows)
        
        # Create cache key
        key = keys.log_recent(level, limit)
        
        # Define fetcher function
        async def fetcher() -> List[Dict[str, Any]]:
            query, params = self.queries.get_recent_logs(level, limit)
            rows = await self.conn.fetch(query, *params)
            return self._build_recent_logs_response(rows)
        
        # Query with cache
        return cast(
            List[Dict[str, Any]],
            await qc.query(
                key,
                fetcher,
                tags=list(key.tags()),
                fresh_ttl=30,
                stale_ttl=300
            )
        )
    
    def _build_recent_logs_response(self, rows: List[Any]) -> List[Dict[str, Any]]:
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


def get_log_service(conn: asyncpg.Connection) -> LogService:
    """Get log service instance."""
    return LogService(conn)
