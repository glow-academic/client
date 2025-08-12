import logging
import uuid
from typing import Any, List

from agents import (Agent, GuardrailFunctionOutput, OutputGuardrail, Runner,
                    TContext, trace)
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Agents, DebugInfo, ModelRuns, Models, Providers,
                        SimulationAttempts, SimulationChats,
                        SimulationMessages)
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class GuardStudentResponse(BaseModel):
    proper: bool
    reason: str
    debug_info: str | None = None


def _build_guardrail_agent(session: Session) -> tuple[GenericAgent, uuid.UUID, uuid.UUID]:
    """Create the internal agent that powers the guardrail from DB-configured Agent named 'Guardrail'."""
    agent_row = session.exec(select(Agents).where(Agents.name == "Guardrail")).one()
    if not agent_row:
        raise ValueError("Guardrail agent not found")

    model = session.exec(select(Models).where(Models.id == agent_row.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent_row.model_id} not found")

    provider = session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    return GenericAgent(
        agent_name=agent_row.name,
        system_prompt=agent_row.system_prompt,
        temperature=agent_row.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        api_key=provider.api_key,
        reasoning=agent_row.reasoning,
        output_type=GuardStudentResponse,
    ), agent_row.id, model.id


def get_output_guardrails(
    chat_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    session: Session = Depends(get_session),
) -> List[OutputGuardrail[TContext]]:
    """Return a list of output guardrails suitable for attaching to an Agent."""
    guardrail_agent, agent_id, model_id = _build_guardrail_agent(session)

    async def _output_guard(ctx: Any, agent: Agent, output: str) -> GuardrailFunctionOutput:
        db_session = next(get_session())
        try:

            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == chat_id)
            ).one()

            attempt = db_session.exec(
                select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
            ).one()

            profile_id = attempt.profile_id

            default_guest_profile = find_default_guest_profile(session)

            # Intro message before the history
            intro_message: TResponseInputItem = {
                "role": "user",
                "content": (
                    "The following is the conversation between the graduate teaching assistant and "
                    "student, evalute carefully if the AI student adheres to its role."
                ),
            }
            input_items.append(intro_message)

            final_profile_id = (profile_id if profile_id else (default_guest_profile.id if default_guest_profile else None))

            success, error_message = check_rate_limit(final_profile_id, session)
            if not success:
                raise ValueError(error_message)
            
            model_run = ModelRuns(
                model_id=model_id,
                input_tokens=0,
                output_tokens=0,
                profile_id=final_profile_id,
                agent_id=agent_id,
            )
            session.add(model_run)
            session.commit()

            with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
                result = await Runner.run(
                    guardrail_agent.agent(), input_items, context=DebugContext(session=session, model_run_id=model_run.id)
                )

            usage = result.context_wrapper.usage
            model_run.input_tokens = usage.input_tokens
            model_run.output_tokens = usage.output_tokens
            session.commit()
            
            out = result.final_output_as(GuardStudentResponse)

            # Store debug info if present
            if getattr(out, "debug_info", None):
                debug = DebugInfo(
                    model_run_id=model_run.id,
                    content=out.debug_info or "",
                )
                session.add(debug)
                session.commit()
            return GuardrailFunctionOutput(
                output_info=out, tripwire_triggered=not out.proper
            )
        finally:
            db_session.close()
    output_guard = OutputGuardrail(_output_guard)
    return [output_guard]
