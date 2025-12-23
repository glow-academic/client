"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/keycloak/get_auth_providers_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthProvidersSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/keycloak/get_auth_providers_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthProvidersSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
    slug: str
    provider_id: str
    name: str
