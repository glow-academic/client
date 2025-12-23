"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_pricing_analytics_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetPricingAnalyticsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    start_date: str
    param_2: str
    param_3: list[UUID]
    param_4: UUID
    param_5: list[str]
    param_6: list[UUID]
    param_7: list[str]

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.start_date,
            self.param_2,
            self.param_3,
            self.param_4,
            self.param_5,
            self.param_6,
            self.param_7,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_pricing_analytics_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetPricingAnalyticsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    result: dict[str, Any]
