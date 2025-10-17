import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List

import asyncpg  # type: ignore
from agents import (Runner, ToolsToFinalOutputResult, TResponseInputItem,
                    function_tool, trace)
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from app.utils.rubric import get_dynamic_rubric
from fastapi import Depends
from pydantic import Field

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
    standard_group: Any, 
    standards: List[Any],
    chat_id: uuid.UUID
) -> Any:
    """Create a function tool for grading a specific standard group."""
    safe_name = create_safe_field_name(standard_group['short_name'])
    
    # Get standards for this group and build rating scale
    group_standards = [s for s in standards if s['standard_group_id'] == standard_group['id']]
    group_standards.sort(key=lambda x: x['points'], reverse=True)
    
    rating_scale = "\n".join([
        f"  {std['points']} - {std['name']}: {std.get('description', '')}" 
        for std in group_standards
    ])
    
    full_description = f"{standard_group.get('description', '')}\n\nRating Scale:\n{rating_scale}"
    score_description = f"Score for {standard_group['name']} (1-5)"
    feedback_description = f"Feedback explaining the score for {standard_group['name']}"
    
    async def grade_standard_group(
        score: int = Field(ge=1, le=5, description=score_description),
        feedback: str = Field(default="", description=feedback_description),
    ) -> str:
        f"""Grade the conversation on: {standard_group['name']}
        
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
            "standard_group_name": standard_group['name'],
            "standard_group_short_name": standard_group['short_name'],
            "score": score,
            "feedback_preview": feedback[:100] + "..." if len(feedback) > 100 else feedback,
            "completed_count": sum(1 for v in grading_progress.values() if v),
            "total_count": len(grading_progress),
        })
        
        logger.info(f"✓ Graded {standard_group['name']}: {score}/5 - {feedback[:50]}...")
        return f"Graded {standard_group['name']} with score {score}"
    
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
    standard_groups: List[Any], 
    standards: List[Any],
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
    department_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    sio_instance: Any = None
) -> str:
    """
    This function is used to run the grading agent for simulation chats.
    Returns a string of the simulation_chat_grade id.

    Args:
        simulation_chat_id: The ID of the simulation chat
        conn: Database connection
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
        
        # Get the grade agent configured for this department (via junction table)
        from app.utils.agents import get_department_agent
        agent = await get_department_agent(conn, department_id, 'grade')

        # get the chat from the simulation_chat_id
        chat = await conn.fetchrow(
            "SELECT id, scenario_id, attempt_id, title, trace_id FROM simulation_chats WHERE id = $1",
            simulation_chat_id
        )
        if not chat:
            raise ValueError(f"Chat {simulation_chat_id} not found")

        # get the scenario from the chat
        scenario = await conn.fetchrow(
            "SELECT id FROM scenarios WHERE id = $1",
            chat['scenario_id']
        )
        if not scenario:
            raise ValueError(f"Scenario {chat['scenario_id']} not found")

        # get all the messages for the chat_id, order by created_at
        messages = await conn.fetch("""
            SELECT id, chat_id, role, content, created_at, model_run_id, audio_url, completed
            FROM simulation_messages
            WHERE chat_id = $1
            ORDER BY created_at
        """, simulation_chat_id)

        messages = [dict(m) for m in messages]

        input_items: list[TResponseInputItem] = []

        # prepare conversation history from chat_id
        conversation_history = get_simulation_conversation_history(messages)

        chat_scenario = await get_chat_scenario(conn, chat['scenario_id'])

        input_items.insert(0, chat_scenario)
        input_items.extend(conversation_history)

        # Get the simulation attempt to find the simulation
        attempt = await conn.fetchrow(
            "SELECT id, simulation_id FROM simulation_attempts WHERE id = $1",
            chat['attempt_id']
        )
        if not attempt:
            raise ValueError(f"Attempt {chat['attempt_id']} not found")

        # Get the simulation to find the rubric
        simulation = await conn.fetchrow(
            "SELECT id, rubric_id FROM simulations WHERE id = $1",
            attempt['simulation_id']
        )
        if not simulation:
            raise ValueError(f"Simulation {attempt['simulation_id']} not found")

        if not simulation['rubric_id']:
            raise ValueError(
                f"Simulation {simulation['id']} does not have a rubric assigned"
            )

        rubric_id = simulation['rubric_id']

        # get rubric from rubric_id
        rubric = await conn.fetchrow(
            "SELECT id, name, description, points, pass_points FROM rubrics WHERE id = $1",
            rubric_id
        )
        if not rubric:
            raise ValueError(f"Rubric {rubric_id} not found")

        # get standard groups from rubric
        standard_groups = await conn.fetch("""
            SELECT id, name, short_name, description, points, pass_points, rubric_id
            FROM standard_groups
            WHERE rubric_id = $1
        """, rubric_id)
        standard_groups = [dict(sg) for sg in standard_groups]

        # get standards from standard_groups
        standard_group_ids = [group['id'] for group in standard_groups]
        standards = await conn.fetch("""
            SELECT id, name, description, points, standard_group_id
            FROM standards
            WHERE standard_group_id = ANY($1::uuid[])
        """, standard_group_ids)
        standards = [dict(s) for s in standards]

        logger.info(
            f"Starting grading for simulation chat {simulation_chat_id} with rubric {rubric['name']}"
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
                    "rubric_name": rubric['name'],
                    "standards_count": len(standard_groups),
                },
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(f"Emitted grading start event for chat {simulation_chat_id}")

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(
            rubric, standard_groups, standards
        )

        # get the time limit from the simulation
        time_limit = simulation['time_limit'] or -1
        
        # Calculate adjusted time limit for multi-simulation attempts
        # Get all chats for this attempt to determine if it's multi-simulation
        attempt_chats = await conn.fetch(
            "SELECT id FROM simulation_chats WHERE attempt_id = $1",
            attempt['id']
        )
        
        total_chats = len(attempt_chats)
        adjusted_time_limit = (time_limit * 60) if time_limit and total_chats == 1 else ((time_limit * 60) // total_chats) if time_limit else 0
        
        # Get chat timestamps for time calculation
        chat_times = await conn.fetchrow(
            "SELECT created_at, completed_at FROM simulation_chats WHERE id = $1",
            simulation_chat_id
        )
        
        # Calculate actual time taken for this specific chat using completed_at
        chat_created_at = chat_times['created_at']
        chat_completed_at = chat_times['completed_at']

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
        model = await conn.fetchrow(
            "SELECT id, name, provider_id, custom_model FROM models WHERE id = $1",
            agent['model_id']
        )
        if not model:
            raise ValueError(f"Model with ID {agent['model_id']} not found")

        # getting the provider from the model's provider_id
        provider = await conn.fetchrow(
            "SELECT id, name, base_url, api_key FROM providers WHERE id = $1",
            model['provider_id']
        )
        if not provider:
            raise ValueError(f"Provider with ID {model['provider_id']} not found")

        grading_agent = GenericAgent(
            agent_name=agent['name'],
            system_prompt=agent['system_prompt'],
            temperature=agent['temperature'],
            model_name=model['name'],
            model_provider=provider['name'],
            base_url=provider['base_url'],
            api_key=provider['api_key'],
            reasoning=agent['reasoning'],
            tools=grading_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            custom_model=model['custom_model'],
        )

        agent_instance = grading_agent.agent()

        # Get profile from attempt_profiles junction
        attempt_profile_link = await conn.fetchrow("""
            SELECT profile_id
            FROM attempt_profiles
            WHERE attempt_id = $1 AND active = true
            LIMIT 1
        """, attempt['id'])
        
        attempt_profile_id = attempt_profile_link['profile_id'] if attempt_profile_link else None
        default_guest_profile = await find_default_guest_profile(conn)

        final_profile_id = (attempt_profile_id if attempt_profile_id else (default_guest_profile['id'] if default_guest_profile else None))

        success, error_message = await check_rate_limit(conn, final_profile_id)
        if not success:
            raise ValueError(error_message)

        # create model run
        model_run = await conn.fetchrow("""
            INSERT INTO model_runs (input_tokens, output_tokens, department_id, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        """, 0, 0, simulation['department_id'], datetime.now(timezone.utc))

        model_run_id = model_run['id']

        # Create model_run junction records
        if model['id']:
            await conn.execute("""
                INSERT INTO model_run_models (model_run_id, model_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, model['id'], True)
        
        if agent['id']:
            await conn.execute("""
                INSERT INTO model_run_agents (model_run_id, agent_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, agent['id'], True)
        
        if final_profile_id:
            await conn.execute("""
                INSERT INTO model_run_profiles (model_run_id, profile_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, final_profile_id, True)

        # Run the grading
        logger.info("Running grading agent...")
        with trace(chat['title'], trace_id=chat['trace_id'], group_id=str(attempt['id'])):
            result = await Runner.run(agent_instance, input=input_items, context=DebugContext(conn=conn, model_run_id=model_run_id))

        usage = result.context_wrapper.usage

        # Update model run with token usage
        await conn.execute("""
            UPDATE model_runs 
            SET input_tokens = $1, output_tokens = $2 
            WHERE id = $3
        """, usage.input_tokens, usage.output_tokens, model_run_id)

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
            safe_name = create_safe_field_name(group['short_name'])
            group_data = grading_result.get(safe_name, {})
            score = group_data.get("score", 0)
            try:
                overall_score += int(score)
            except (TypeError, ValueError):
                logger.warning(
                    f"Non-integer value for {group['short_name']} ('{score}'); treating as 0"
                )

        passed = overall_score >= rubric['pass_points']

        # Get summary from tool call results
        summary = grading_result.get("summary", "")

        # Create the simulation chat grade record
        simulation_chat_grade = await conn.fetchrow("""
            INSERT INTO simulation_chat_grades 
            (passed, score, description, time_taken, rubric_id, simulation_chat_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        """, passed, overall_score, summary, actual_time_taken, rubric_id, simulation_chat_id, datetime.now(timezone.utc))

        grade_id = simulation_chat_grade['id']

        # Create feedback records for each standard group
        feedback_count = 0
        for group in standard_groups:
            safe_name = create_safe_field_name(group['short_name'])

            try:
                # Get the score and feedback from tool call results
                group_data = grading_result.get(safe_name, {})
                group_score = group_data.get("score", 0)
                group_feedback = group_data.get("feedback", "")

                logger.info(
                    f"Group {group['short_name']}: score={group_score}, feedback_length={len(group_feedback)}"
                )

                # Find the corresponding standard for this score
                group_standards = [
                    s for s in standards if s['standard_group_id'] == group['id']
                ]
                matching_standard = None
                for standard in group_standards:
                    if standard['points'] == group_score:
                        matching_standard = standard
                        break

                if matching_standard:
                    # Create feedback record
                    await conn.execute("""
                        INSERT INTO simulation_chat_feedbacks 
                        (standard_id, simulation_chat_grade_id, total, feedback, created_at)
                        VALUES ($1, $2, $3, $4, $5)
                    """, matching_standard['id'], grade_id, group_score, group_feedback, datetime.now(timezone.utc))
                    feedback_count += 1
                else:
                    logger.warning(
                        f"No matching standard found for group {group['short_name']} with score {group_score}"
                    )

            except Exception as e:
                logger.error(
                    f"Failed to get grading data for group {group['short_name']}: {e}"
                )
                continue

        logger.info(f"Created {feedback_count} feedback records")

        # Mark chat as completed
        await conn.execute(
            "UPDATE simulation_chats SET completed = $1 WHERE id = $2",
            True,
            simulation_chat_id
        )

        # Emit grading completion event
        if sio_instance:
            await sio_instance.emit(
                "simulation_grading_progress",
                {
                    "type": "complete",
                    "chat_id": str(simulation_chat_id),
                    "message": "Grading completed successfully",
                    "grade_id": str(grade_id),
                    "total_score": overall_score,
                    "passed": passed,
                    "standards_graded": feedback_count,
                    "time_taken": actual_time_taken,
                    "summary": summary,
                },
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(f"Emitted grading completion event for chat {simulation_chat_id}")

        logger.info(
            f"Grading completed successfully with grade ID: {grade_id}"
        )
        
        # Clean up socket context
        _grading_sio_instance = None
        _grading_chat_id = None
        
        return str(grade_id)

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
        
        raise
