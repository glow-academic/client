"""
Hint Agent Service
Provides GTA response suggestions based on student messages
"""

import json
import logging
import uuid
from typing import List, Optional

from agents import Runner, trace
from app.db import get_session
from app.models import Agents, ModelRuns, Models, Providers
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


async def run_hint_agent(
    student_message: str,
    chat_id: str,
    session: Session,
    profile_id: Optional[str] = None,
) -> List[str]:
    """
    Run the hint agent to generate GTA response suggestions
    
    Args:
        student_message: The student's message to generate hints for
        chat_id: The chat ID for context
        session: Database session
        profile_id: Optional profile ID for context
        
    Returns:
        List of 3 GTA response suggestions
    """
    try:
        # Get the Hint agent
        hint_agent = session.exec(
            select(Agents).where(Agents.name == "Hint")
        ).one_or_none()
        
        if not hint_agent:
            logger.error("Hint agent not found in database")
            return [
                "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
                "That's a great question! Let's work through this step by step.",
                "I can see you're working on this problem. What approach are you considering?"
            ]
        
        # Get the model from the agent's model_id
        model = session.exec(
            select(Models).where(Models.id == hint_agent.model_id)
        ).one_or_none()
        if not model:
            logger.error(f"Model with ID {hint_agent.model_id} not found")
            return [
                "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
                "That's a great question! Let's work through this step by step.",
                "I can see you're working on this problem. What approach are you considering?"
            ]

        # Get the provider from the model's provider_id
        provider = session.exec(
            select(Providers).where(Providers.id == model.provider_id)
        ).one_or_none()
        if not provider:
            logger.error(f"Provider with ID {model.provider_id} not found")
            return [
                "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
                "That's a great question! Let's work through this step by step.",
                "I can see you're working on this problem. What approach are you considering?"
            ]

        # Create the agent instance
        agent_instance = GenericAgent(
            agent_name=hint_agent.name,
            system_prompt=hint_agent.system_prompt,
            temperature=hint_agent.temperature,
            model_name=model.name,
            model_provider=provider.name,
            base_url=provider.base_url,
            reasoning=hint_agent.reasoning,
            api_key=provider.api_key,
            custom_model=model.custom_model,
        )

        # Get profile ID for rate limiting
        default_guest_profile = find_default_guest_profile(session)
        final_profile_id_uuid = None
        if profile_id:
            final_profile_id_uuid = uuid.UUID(profile_id)
        elif default_guest_profile:
            final_profile_id_uuid = default_guest_profile.id

        # Check rate limit
        success, error_message = check_rate_limit(final_profile_id_uuid, session)
        if not success:
            logger.error(f"Rate limit exceeded: {error_message}")
            return [
                "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
                "That's a great question! Let's work through this step by step.",
                "I can see you're working on this problem. What approach are you considering?"
            ]

        # Create model run
        model_run = ModelRuns(
            model_id=model.id,
            input_tokens=0,
            output_tokens=0,
            profile_id=final_profile_id_uuid,
            agent_id=hint_agent.id,
        )
        session.add(model_run)
        session.commit()

        # Prepare the hint-specific input
        hint_input = f"""Based on this student message: "{student_message}"

Provide exactly 3 different response suggestions that a Graduate Teaching Assistant (GTA) could say. Each suggestion should be:
1. Professional and supportive
2. Educational and constructive  
3. Appropriate for a graduate-level teaching context
4. Helpful in guiding the student toward understanding

Format your response as a JSON array with exactly 3 strings, each containing one GTA response suggestion. Do not include any explanations or additional text - just the JSON array."""

        # Run the agent
        trace_id = f"hint_{chat_id}_{uuid.uuid4().hex[:8]}"
        with trace("Hint Agent", trace_id=trace_id, group_id=chat_id):
            result = Runner.run_streamed(
                agent_instance.agent(),
                input=hint_input,
                context=DebugContext(session=session, model_run_id=model_run.id)
            )

        # Collect the response
        accumulated_content = ""
        hints = []
        
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    token = event.data.delta
                    accumulated_content += token
                    
                    # Try to parse JSON when we have enough content
                    if accumulated_content.strip().startswith('[') and accumulated_content.strip().endswith(']'):
                        try:
                            hints = json.loads(accumulated_content.strip())
                            if isinstance(hints, list) and len(hints) >= 3:
                                return hints[:3]  # Return first 3 hints
                        except json.JSONDecodeError:
                            continue
        
        # Fallback: if we couldn't parse JSON, return default hints
        if not hints or len(hints) < 3:
            hints = [
                "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
                "That's a great question! Let's work through this step by step.",
                "I can see you're working on this problem. What approach are you considering?"
            ]
        
        return hints[:3]
        
    except Exception as e:
        logger.error(f"Error in run_hint_agent: {str(e)}")
        # Return default hints on any error
        return [
            "I'd be happy to help you with that. Can you tell me more about what you're thinking?",
            "That's a great question! Let's work through this step by step.",
            "I can see you're working on this problem. What approach are you considering?"
        ]
