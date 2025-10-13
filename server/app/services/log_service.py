"""Log service with business logic and dynamic SQL."""

from typing import Any, Dict, List, Optional

from app.queries.log_queries import LogQueries
from app.schemas.logs import (ActorData, ContextData, ErrorData, LogItem,
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

