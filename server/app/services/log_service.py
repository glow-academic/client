"""Log service with business logic and dynamic SQL."""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models import AppLogs
from app.queries.log_queries import LogQueries
from app.schemas.logs import (ActorData, ContextData, CreateLogRequest,
                              CreateLogResponse, ErrorData, LogItem,
                              LogsListRequest, LogsListResponse, MetricsData,
                              SubjectData)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class LogService:
    """Service for log operations."""

    def __init__(self) -> None:
        """Initialize service with query builders."""
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
        self, request: LogsListRequest, session: AsyncSession
    ) -> LogsListResponse:
        """
        Get list of logs with actor information and all JSONB fields.

        Args:
            request: List request
            session: Database session

        Returns:
            LogsListResponse
        """
        query, params = self.queries.get_logs_list()

        result = await session.execute(text(query), params)
        rows = result.fetchall()

        log_items: List[LogItem] = []
        for row in rows:
            log_items.append(
                LogItem(
                    log_id=row.log_id,
                    event=row.event,
                    level=row.level,
                    message=row.message,
                    correlation_id=row.correlation_id,
                    actor=self._parse_jsonb_to_model(row.actor, ActorData),
                    subject=self._parse_jsonb_to_model(row.subject, SubjectData),
                    metrics=self._parse_jsonb_to_model(row.metrics, MetricsData),
                    context=self._parse_jsonb_to_model(row.context, ContextData),
                    error=self._parse_jsonb_to_model(row.error, ErrorData),
                    created_at=row.created_at.isoformat()
                    if row.created_at
                    else "",
                    actor_name=row.actor_name,
                )
            )

        return LogsListResponse(logs=log_items)

    async def create_log(
        self, request: CreateLogRequest, session: AsyncSession
    ) -> CreateLogResponse:
        """
        Create a new log entry.

        Args:
            request: Create request
            session: Database session

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
        insert_query = text("""
            INSERT INTO app_logs (
                event, level, message, correlation_id, actor, subject, metrics, context, error, created_at
            ) VALUES (
                :event, :level, :message, :correlation_id,
                :actor, :subject, :metrics, :context, :error, :created_at
            )
            RETURNING id
        """)

        result = await session.execute(
            insert_query,
            {
                "event": request.event or "legacy.message",
                "level": request.level or "info",
                "message": request.message,
                "correlation_id": correlation_id,
                "actor": json.dumps(actor_json) if actor_json else None,
                "subject": json.dumps(subject_json) if subject_json else None,
                "metrics": json.dumps(metrics_json) if metrics_json else None,
                "context": json.dumps(context_json) if context_json else None,
                "error": json.dumps(error_json) if error_json else None,
                "created_at": datetime.utcnow().isoformat(),
            }
        )

        await session.commit()

        log_id = result.scalar()

        return CreateLogResponse(success=True, log_id=log_id)

