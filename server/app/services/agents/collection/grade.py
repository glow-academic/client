import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from agents import Runner, TResponseInputItem, trace
from app.db import get_session
from app.models import (Agents, DebugInfo, ModelRuns, Models, Providers,
                        Rubrics, Scenarios, SimulationAttempts,
                        SimulationChatFeedbacks, SimulationChatGrades,
                        SimulationChats, SimulationMessages, Simulations,
                        StandardGroups, Standards)
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from app.utils.rubric import get_dynamic_rubric
from fastapi import Depends
from pydantic import BaseModel, Field, create_model
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def create_safe_field_name(short_name: str) -> str:
    """
    Create a safe field name from a short_name by removing special characters and spaces.

    Args:
        short_name: The short name from the standard group

    Returns:
        Safe field name for use in Pydantic models
    """
    safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", short_name.lower())
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    return safe_name


def create_dynamic_rubric_model(
    standard_groups: List[StandardGroups],
) -> type[BaseModel]:
    """
    Create a dynamic Pydantic model based on the rubric's standard groups.

    Args:
        standard_groups: List of standard groups for this rubric

    Returns:
        Dynamic Pydantic model class
    """
    fields: dict[str, Any] = {}

    for group in standard_groups:
        # Create safe field names by removing special characters and spaces
        safe_name = create_safe_field_name(group.short_name)

        # Create field for the score (1-5)
        score_field_name = f"{safe_name}_score"
        fields[score_field_name] = (
            int,
            Field(ge=1, le=5, description=f"Score for {group.name} (1-5)"),
        )

        # Create field for the feedback
        feedback_field_name = f"{safe_name}_feedback"
        fields[feedback_field_name] = (
            str,
            Field(description=f"Feedback for {group.name}"),
        )

    # Add overall fields
    fields["summary"] = (str, Field(description="Overall evaluation summary"))

    # Optional internal debug field (never shown to end users)
    fields["debug_info"] = (Optional[str], Field(default=None, description="Optional internal debug info"))

    return create_model("DynamicRubricGrade", **fields)  # type: ignore


async def run_grade_agent(
    simulation_chat_id: uuid.UUID, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the grading agent for simulation chats.
    Returns a string of the simulation_chat_grade id.

    Args:
        simulation_chat_id: The ID of the simulation chat

    Returns:
        A string of the simulation_chat_grade id.
    """
    try:
        # find agent with name of "Grade"
        agent = session.exec(select(Agents).where(Agents.name == "Grade")).one()
        if not agent:
            raise ValueError("Grade agent not found")

        # get the chat from the simulation_chat_id
        chat = session.exec(
            select(SimulationChats).where(SimulationChats.id == simulation_chat_id)
        ).one()

        # get the scenario from the chat
        scenario = session.exec(
            select(Scenarios).where(Scenarios.id == chat.scenario_id)
        ).one()

        # get all the messages for the chat_id, order by created_at
        messages = session.exec(
            select(SimulationMessages).where(
                SimulationMessages.chat_id == simulation_chat_id
            )
        ).all()

        messages = list(messages)
        messages = sorted(messages, key=lambda x: x.created_at)

        input_items: list[TResponseInputItem] = []

        # prepare conversation history from chat_id
        conversation_history = get_simulation_conversation_history(messages)

        chat_scenario = get_chat_scenario(chat, session)

        input_items.insert(0, chat_scenario)
        input_items.extend(conversation_history)

        # Get the simulation attempt to find the simulation
        attempt = session.exec(
            select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
        ).one()

        # Get the simulation to find the rubric
        simulation = session.exec(
            select(Simulations).where(Simulations.id == attempt.simulation_id)
        ).one()

        if not simulation.rubric_id:
            raise ValueError(
                f"Simulation {simulation.id} does not have a rubric assigned"
            )

        rubric_id = simulation.rubric_id

        # get rubric from rubric_id
        rubric = session.exec(select(Rubrics).where(Rubrics.id == rubric_id)).one()

        # get standard groups from rubric
        standard_groups = session.exec(
            select(StandardGroups).where(StandardGroups.rubric_id == rubric_id)
        ).all()

        # get standards from standard_groups
        standard_group_ids = [group.id for group in standard_groups]
        standards = session.exec(
            select(Standards).where(Standards.standard_group_id.in_(standard_group_ids))
        ).all()

        logger.info(
            f"Starting grading for simulation chat {simulation_chat_id} with rubric {rubric.name}"
        )
        logger.info(
            f"Found {len(standard_groups)} standard groups and {len(standards)} standards"
        )

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(
            rubric, list(standard_groups), list(standards)
        )

        # get the time limit from the simulation
        time_limit = simulation.time_limit or -1
        
        # Calculate adjusted time limit for multi-simulation attempts
        # Get all chats for this attempt to determine if it's multi-simulation
        attempt_chats = session.exec(
            select(SimulationChats).where(SimulationChats.attempt_id == attempt.id)
        ).all()
        
        total_chats = len(attempt_chats)
        adjusted_time_limit = (time_limit * 60) if time_limit and total_chats == 1 else ((time_limit * 60) // total_chats) if time_limit else 0
        
        # Calculate actual time taken for this specific chat using completed_at
        chat_created_at = chat.created_at
        chat_completed_at = chat.completed_at

        # Convert timestamps to UTC if they have timezone info
        if chat_created_at.tzinfo is not None:
            chat_created_at = chat_created_at.astimezone(timezone.utc)
        else:
            chat_created_at = chat_created_at.replace(tzinfo=timezone.utc)

        # Handle case where completed_at might be None (fallback to current time)
        if chat_completed_at is None:
            current_time = datetime.now(timezone.utc)
            actual_time_taken = max(1, int((current_time - chat_created_at).total_seconds()))
        else:
            if chat_completed_at.tzinfo is not None:
                chat_completed_at = chat_completed_at.astimezone(timezone.utc)
            else:
                chat_completed_at = chat_completed_at.replace(tzinfo=timezone.utc)
            
            # Calculate time taken from created_at to completed_at
            actual_time_taken = max(1, int((chat_completed_at - chat_created_at).total_seconds()))

        def format_minutes(seconds: int) -> str:
            minutes = seconds // 60
            secs = seconds % 60
            return f"{minutes} min {secs} sec" if minutes > 0 else f"{secs} sec"

        # create time message
        time_message: TResponseInputItem
        if adjusted_time_limit > 0:
            time_message = {
                "role": "user",
                "content": f"The adjusted time limit for this chat is {format_minutes(adjusted_time_limit)}. The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric."
            }
        else:
            time_message = {
                "role": "user",
                "content": f"The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric."
            }

        # add rubric to beginning of input_items
        input_items.insert(0, time_message)
        input_items.insert(0, rubric_input) # add rubric message before time message


        # Create dynamic Pydantic model for the rubric
        DynamicRubric = create_dynamic_rubric_model(list(standard_groups))

        # Log the expected field names for debugging and keep score fields separate
        expected_score_fields: list[str] = []
        expected_feedback_fields: list[str] = []
        for group in standard_groups:
            safe_name = create_safe_field_name(group.short_name)
            expected_score_fields.append(f"{safe_name}_score")
            expected_feedback_fields.append(f"{safe_name}_feedback")
        logger.info(
            f"Expected model fields (scores): {expected_score_fields}; (feedback): {expected_feedback_fields}"
        )

        # getting the model from the agent's model_id
        model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
        if not model:
            raise ValueError(f"Model with ID {agent.model_id} not found")

        # getting the provider from the model's provider_id
        provider = session.exec(
            select(Providers).where(Providers.id == model.provider_id)
        ).one()
        if not provider:
            raise ValueError(f"Provider with ID {model.provider_id} not found")

        grading_agent = GenericAgent(
            agent_name=agent.name,
            system_prompt=agent.system_prompt,
            temperature=agent.temperature,
            model_name=model.name,
            model_provider=provider.name,
            base_url=provider.base_url,
            api_key=provider.api_key,
            reasoning=agent.reasoning,
            output_type=DynamicRubric,
            custom_model=model.custom_model,
        )

        agent_instance = grading_agent.agent()

        default_guest_profile = find_default_guest_profile(session)

        final_profile_id = (attempt.profile_id if attempt.profile_id else (default_guest_profile.id if default_guest_profile else None))

        success, error_message = check_rate_limit(final_profile_id, session)
        if not success:
            raise ValueError(error_message)

        # create model run
        model_run = ModelRuns(
            model_id=model.id,
            input_tokens=0,
            output_tokens=0,
            profile_id=final_profile_id,
            agent_id=agent.id,
        )
        session.add(model_run)
        session.commit()

        # Run the grading
        logger.info("Running grading agent...")
        with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
            result = await Runner.run(agent_instance, input=input_items, context=DebugContext(session=session, model_run_id=model_run.id))

        usage = result.context_wrapper.usage

        model_run.input_tokens = usage.input_tokens
        model_run.output_tokens = usage.output_tokens
        session.commit()

        grading_result = result.final_output_as(DynamicRubric)

        # Store debug info if present on dynamic rubric
        if hasattr(grading_result, "debug_info") and getattr(grading_result, "debug_info"):
            debug = DebugInfo(
                model_run_id=model_run.id,
                content=getattr(grading_result, "debug_info") or "",
            )
            session.add(debug)
            session.commit()
        logger.info("Grading agent completed successfully")

        # Log the time calculation
        if chat_completed_at is None:
            logger.info(
                f"Time calculation: created={chat_created_at}, completed=None (using current time), taken={actual_time_taken}s"
            )
        else:
            logger.info(
                f"Time calculation: created={chat_created_at}, completed={chat_completed_at}, taken={actual_time_taken}s"
            )

        # calculate overall score, sum over only the numeric score fields
        overall_score = 0
        for score_field in expected_score_fields:
            value = getattr(grading_result, score_field, 0)
            try:
                overall_score += int(value)
            except (TypeError, ValueError):
                logger.warning(
                    f"Non-integer value for {score_field} ('{value}'); treating as 0 in overall score"
                )
        passed = overall_score >= rubric.pass_points

        summary = getattr(grading_result, "summary", "")

        # Create the simulation chat grade record
        simulation_chat_grade = SimulationChatGrades(
            passed=passed,
            score=overall_score,
            description=summary,
            time_taken=actual_time_taken,
            rubric_id=rubric_id,
            simulation_chat_id=simulation_chat_id,
        )

        session.add(simulation_chat_grade)
        session.flush()  # Get the ID without committing

        # Create feedback records for each standard group
        feedback_count = 0
        for group in standard_groups:
            # Create safe field names (same logic as in model creation)
            safe_name = create_safe_field_name(group.short_name)

            # Get the score and feedback for this group
            score_field = f"{safe_name}_score"
            feedback_field = f"{safe_name}_feedback"

            try:
                group_score = getattr(grading_result, score_field, 0)
                group_feedback = getattr(grading_result, feedback_field, "")

                logger.info(
                    f"Group {group.short_name}: score={group_score}, feedback_length={len(group_feedback)}"
                )

                # Find the corresponding standard for this score
                group_standards = [
                    s for s in standards if s.standard_group_id == group.id
                ]
                matching_standard = None
                for standard in group_standards:
                    if standard.points == group_score:
                        matching_standard = standard
                        break

                if matching_standard:
                    # Create feedback record
                    simulation_chat_feedback = SimulationChatFeedbacks(
                        standard_id=matching_standard.id,
                        simulation_chat_grade_id=simulation_chat_grade.id,
                        total=group_score,
                        feedback=group_feedback,
                    )
                    session.add(simulation_chat_feedback)
                    feedback_count += 1
                else:
                    logger.warning(
                        f"No matching standard found for group {group.short_name} with score {group_score}"
                    )

            except AttributeError as e:
                logger.error(
                    f"Failed to get grading data for group {group.short_name}: {e}"
                )
                continue

        logger.info(f"Created {feedback_count} feedback records")

        # Mark chat as completed
        chat.completed = True
        session.add(chat)

        # Commit all changes
        session.commit()
        session.refresh(simulation_chat_grade)

        logger.info(
            f"Grading completed successfully with grade ID: {simulation_chat_grade.id}"
        )
        return str(simulation_chat_grade.id)

    except Exception as e:
        logger.error(f"Error in run_grade_agent: {str(e)}", exc_info=True)
        session.rollback()
        raise
