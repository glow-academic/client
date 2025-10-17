"""Model run service layer - business logic for tracking model usage and tokens."""

from typing import Literal, Optional
from uuid import UUID

import asyncpg  # type: ignore
from app.queries.model_run_queries import ModelRunQueries


class ModelRunService:
    """Service layer for model run operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = ModelRunQueries()

    async def create_model_run(
        self,
        department_id: UUID,
        model_id: UUID,
        entity_id: UUID,
        entity_type: Literal["agent", "persona"],
        profile_id: Optional[UUID] = None,
    ) -> UUID:
        """
        Create a model run with all junction records in a single transaction.

        This consolidates 4 database calls into a single service method:
        1. Create model_run record
        2. Link to model (model_run_models)
        3. Link to agent or persona (model_run_agents or model_run_personas)
        4. Link to profile if provided (model_run_profiles)

        Args:
            department_id: Department where run occurs
            model_id: Model being used
            entity_id: Agent or Persona ID
            entity_type: "agent" or "persona"
            profile_id: Optional profile making the request

        Returns:
            UUID of created model_run

        Raises:
            ValueError: If entity_type is invalid
        """
        if entity_type not in ["agent", "persona"]:
            raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'agent' or 'persona'")

        department_id_str = str(department_id)
        model_id_str = str(model_id)
        entity_id_str = str(entity_id)

        # 1. Create model run
        query, params = self.queries.create_model_run(department_id_str)
        model_run_result = await self.conn.fetchval(query, *params)
        model_run_id_str = str(model_run_result)

        # 2. Link model to run
        query, params = self.queries.create_model_run_model(
            model_run_id_str, model_id_str
        )
        await self.conn.execute(query, *params)

        # 3. Link agent or persona to run
        if entity_type == "agent":
            query, params = self.queries.create_model_run_agent(
                model_run_id_str, entity_id_str
            )
        else:  # persona
            query, params = self.queries.create_model_run_persona(
                model_run_id_str, entity_id_str
            )
        await self.conn.execute(query, *params)

        # 4. Link profile to run if provided
        if profile_id is not None:
            profile_id_str = str(profile_id)
            query, params = self.queries.create_model_run_profile(
                model_run_id_str, profile_id_str
            )
            await self.conn.execute(query, *params)

        return UUID(model_run_id_str)

    async def update_model_run_tokens(
        self,
        model_run_id: UUID,
        input_tokens: int,
        output_tokens: int,
    ) -> None:
        """
        Update token counts for a completed model run.

        This is called after the agent/model execution completes to record
        the actual token usage for billing and analytics.

        Args:
            model_run_id: ID of the model run
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated
        """
        model_run_id_str = str(model_run_id)
        query, params = self.queries.update_model_run_tokens(
            model_run_id_str, input_tokens, output_tokens
        )
        await self.conn.execute(query, *params)

