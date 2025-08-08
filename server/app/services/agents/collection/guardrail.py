import logging
from typing import Any, Callable, List, Union

import agents as agents_sdk  # type: ignore
from agents import GuardrailFunctionOutput, Runner
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Agents, Models, Providers
from app.services.agents.generic import GenericAgent
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class GuardStudentResponse(BaseModel):
    proper: bool
    reason: str


def _build_guardrail_agent(session: Session) -> GenericAgent:
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
    )


def get_output_guardrails(
    session: Session = Depends(get_session),
) -> List[Any]:
    """Return a list of output guardrails suitable for attaching to an Agent."""
    guardrail_agent = _build_guardrail_agent(session)

    async def _output_guard(ctx: Any, agent: Any, output: Any) -> GuardrailFunctionOutput:
        result = await Runner.run(
            guardrail_agent.agent(), getattr(output, "response", str(output)), context=ctx.context
        )
        out = result.final_output_as(GuardStudentResponse)
        return GuardrailFunctionOutput(output_info=out, tripwire_triggered=not out.proper)

    output_guardrail_fn = getattr(agents_sdk, "output_guardrail")  # type: ignore[attr-defined]
    output_guard = output_guardrail_fn(_output_guard)
    return [output_guard]
