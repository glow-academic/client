import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List

from agents import (Runner, ToolsToFinalOutputResult, TResponseInputItem,
                    function_tool, trace)
from app.db import get_session
from app.models import (Agents, ModelRuns, Models, Providers, Rubrics,
                        Scenarios, SimulationAttempts, SimulationChatFeedbacks,
                        SimulationChatGrades, SimulationChats,
                        SimulationMessages, Simulations, StandardGroups,
                        Standards)
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from app.utils.rubric import get_dynamic_rubric
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for grading results
grading_results: dict[str, Any] = {}
grading_progress: dict[str, bool] = {}

# Socket.IO instance for progress emissions (set per grading run)
_grading_sio_instance: Any = None
_grading_chat_id: uuid.UUID | None = None


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


async def _emit_grading_progress(event_data: dict[str, Any]) -> None:
    """Helper to emit grading progress via Socket.IO if available."""
    global _grading_sio_instance, _grading_chat_id
    
    if _grading_sio_instance and _grading_chat_id:
        try:
            await _grading_sio_instance.emit(
                "simulation_grading_progress",
                event_data,
                room=f"simulation_{_grading_chat_id}",
            )
            logger.info(f"Emitted grading progress: {event_data.get('type')}")
        except Exception as e:
            logger.warning(f"Failed to emit grading progress: {e}")


def create_grading_function(
    standard_group: StandardGroups, 
    standards: List[Standards],
    chat_id: uuid.UUID
) -> Any:
    """Create a function tool for grading a specific standard group."""
    safe_name = create_safe_field_name(standard_group.short_name)
    
    # Get standards for this group and build rating scale
    group_standards = [s for s in standards if s.standard_group_id == standard_group.id]
    group_standards.sort(key=lambda x: x.points, reverse=True)
    
    rating_scale = "\n".join([
        f"  {std.points} - {std.name}: {std.description}" 
        for std in group_standards
    ])
    
    full_description = f"{standard_group.description}\n\nRating Scale:\n{rating_scale}"
    score_description = f"Score for {standard_group.name} (1-5)"
    feedback_description = f"Feedback explaining the score for {standard_group.name}"
    
    async def grade_standard_group(
        score: int = Field(ge=1, le=5, description=score_description),
        feedback: str = Field(default="", description=feedback_description),
    ) -> str:
        f"""Grade the conversation on: {standard_group.name}
        
        {full_description}
        
        Args:
            score: Integer score from 1-5 based on the rubric criteria above
            feedback: Brief feedback explaining the score with specific examples
            
        Returns:
            Confirmation message
        """
        grading_results[safe_name] = {"score": score, "feedback": feedback}
        grading_progress[safe_name] = True
        
        # Emit progress event
        await _emit_grading_progress({
            "type": "standard_graded",
            "chat_id": str(chat_id),
            "standard_group_name": standard_group.name,
            "standard_group_short_name": standard_group.short_name,
            "score": score,
            "feedback_preview": feedback[:100] + "..." if len(feedback) > 100 else feedback,
            "completed_count": sum(1 for v in grading_progress.values() if v),
            "total_count": len(grading_progress),
        })
        
        logger.info(f"✓ Graded {standard_group.name}: {score}/5 - {feedback[:50]}...")
        return f"Graded {standard_group.name} with score {score}"
    
    grade_standard_group.__name__ = f"grade_{safe_name}"
    return function_tool(grade_standard_group)


def create_summary_function(chat_id: uuid.UUID) -> Any:
    """Create a function tool for recording the overall summary."""
    
    async def record_summary(
        summary: str = Field(description="Overall evaluation summary synthesizing main strengths and areas for improvement")
    ) -> str:
        """Record the overall evaluation summary after grading all standards.
        
        This should be a 2-3 sentence summary that synthesizes the TA's main strengths 
        and areas for improvement based on the rubric evaluation.
        
        Args:
            summary: Overall summary of the evaluation
            
        Returns:
            Confirmation message
        """
        grading_results["summary"] = summary
        grading_progress["summary"] = True
        
        # Emit progress event
        await _emit_grading_progress({
            "type": "summary_recorded",
            "chat_id": str(chat_id),
            "message": "Overall summary recorded",
            "summary_preview": summary[:150] + "..." if len(summary) > 150 else summary,
        })
        
        logger.info(f"✓ Recorded summary: {summary[:100]}...")
        return "Summary recorded successfully"
    
    return function_tool(record_summary)


def create_grading_tools(
    standard_groups: List[StandardGroups], 
    standards: List[Standards],
    chat_id: uuid.UUID
) -> list[Any]:
    """Create all grading function tools for the standard groups."""
    tools = []
    
    for group in standard_groups:
        tool = create_grading_function(group, standards, chat_id)
        tools.append(tool)
        logger.info(f"Created grading tool for: {group.name}")
    
    # Add summary tool
    tools.append(create_summary_function(chat_id))
    logger.info("Created summary tool")
    
    logger.info(f"Total grading tools created: {len(tools)}")
    return tools


async def run_grade_agent(
    simulation_chat_id: uuid.UUID, 
    session: Session = Depends(get_session),
    sio_instance: Any = None
) -> str:
    """
    This function is used to run the grading agent for simulation chats.
    Returns a string of the simulation_chat_grade id.

    Args:
        simulation_chat_id: The ID of the simulation chat
        session: Database session
        sio_instance: Optional Socket.IO instance for progress events

    Returns:
        A string of the simulation_chat_grade id.
    """
    try:
        # Clear previous results and set up socket context
        global grading_results, grading_progress, _grading_sio_instance, _grading_chat_id
        grading_results.clear()
        grading_progress.clear()
        _grading_sio_instance = sio_instance
        _grading_chat_id = simulation_chat_id
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

        # Emit grading start event
        if sio_instance:
            await sio_instance.emit(
                "simulation_grading_progress",
                {
                    "type": "start",
                    "chat_id": str(simulation_chat_id),
                    "message": "Starting grading process",
                    "rubric_name": rubric.name,
                    "standards_count": len(standard_groups),
                },
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(f"Emitted grading start event for chat {simulation_chat_id}")

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

        # Create grading tools for each standard group
        grading_tools = create_grading_tools(list(standard_groups), list(standards), simulation_chat_id)
        # Add debug_info tool from utils
        grading_tools.append(debug_info_tool)
        logger.info(f"Created {len(grading_tools)} grading tools (including debug_info)")

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            context: Any, tool_results: list[Any]
        ) -> ToolsToFinalOutputResult:
            # Build list of required tools (all standard groups + summary, debug_info is optional)
            required_tools = ["summary"]
            for group in standard_groups:
                safe_name = create_safe_field_name(group.short_name)
                required_tools.append(safe_name)
            
            # Check if all required tools have been called
            completed_required = all(
                grading_progress.get(tool, False) for tool in required_tools
            )
            
            logger.info(
                f"Tool use check: required={required_tools}, completed={completed_required}, progress={grading_progress}"
            )
            return ToolsToFinalOutputResult(is_final_output=completed_required)

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
            tools=grading_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
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

        # Extract results from the global storage
        grading_result = grading_results

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

        # Calculate overall score from tool call results
        overall_score = 0
        for group in standard_groups:
            safe_name = create_safe_field_name(group.short_name)
            group_data = grading_result.get(safe_name, {})
            score = group_data.get("score", 0)
            try:
                overall_score += int(score)
            except (TypeError, ValueError):
                logger.warning(
                    f"Non-integer value for {group.short_name} ('{score}'); treating as 0"
                )

        passed = overall_score >= rubric.pass_points

        # Get summary from tool call results
        summary = grading_result.get("summary", "")

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
            safe_name = create_safe_field_name(group.short_name)

            try:
                # Get the score and feedback from tool call results
                group_data = grading_result.get(safe_name, {})
                group_score = group_data.get("score", 0)
                group_feedback = group_data.get("feedback", "")

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

            except Exception as e:
                logger.error(
                    f"Failed to get grading data for group {group.short_name}: {e}"
                )
                continue

        logger.info(f"Created {feedback_count} feedback records")

        # Mark chat as completed
        chat.completed = True
        session.add(chat)

        # Emit grading completion event
        if sio_instance:
            await sio_instance.emit(
                "simulation_grading_progress",
                {
                    "type": "complete",
                    "chat_id": str(simulation_chat_id),
                    "message": "Grading completed successfully",
                    "grade_id": str(simulation_chat_grade.id),
                    "total_score": overall_score,
                    "passed": passed,
                    "standards_graded": feedback_count,
                    "time_taken": actual_time_taken,
                    "summary": summary,
                },
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(f"Emitted grading completion event for chat {simulation_chat_id}")

        # Commit all changes
        session.commit()
        session.refresh(simulation_chat_grade)

        logger.info(
            f"Grading completed successfully with grade ID: {simulation_chat_grade.id}"
        )
        
        # Clean up socket context
        _grading_sio_instance = None
        _grading_chat_id = None
        
        return str(simulation_chat_grade.id)

    except Exception as e:
        logger.error(f"Error in run_grade_agent: {str(e)}", exc_info=True)
        
        # Emit error event
        if sio_instance:
            try:
                await sio_instance.emit(
                    "simulation_grading_progress",
                    {
                        "type": "error",
                        "chat_id": str(simulation_chat_id),
                        "message": f"Grading failed: {str(e)}",
                        "error": str(e),
                    },
                    room=f"simulation_{simulation_chat_id}",
                )
            except Exception as emit_error:
                logger.warning(f"Failed to emit error event: {emit_error}")
        
        # Clean up socket context (global already declared at top of try block)
        _grading_sio_instance = None
        _grading_chat_id = None
        
        session.rollback()
        raise
