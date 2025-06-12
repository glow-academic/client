from app.db import get_session
from sqlmodel import Session
from app.models import (
    Rubrics,
    EvalChats,
    EvalMessages,
    EvalRuns,
    StandardGroups,
    Standards,
    EvalChatGrades,
    EvalChatFeedbacks,
)
from fastapi import Depends
import logging
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history
from app.utils.rubric import get_dynamic_rubric
from sqlmodel import select
from pydantic import BaseModel, Field, create_model
from datetime import datetime
from typing import List
import re

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
    fields = {}

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
    fields["overall_score"] = (int, Field(description="Overall total score"))
    fields["passed"] = (bool, Field(description="Whether the evaluation passed"))
    fields["summary"] = (str, Field(description="Overall evaluation summary"))

    return create_model("DynamicRubricEvaluation", **fields)


async def run_evaluate_agent(
    eval_chat_id: str, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the evaluate agent.
    Returns a string of the eval_chat_grade id.

    Args:
        eval_chat_id: The ID of the evaluation chat

    Returns:
        A string of the eval_chat_grade id.
    """
    try:
        # get the chat from the chat_id
        chat = session.exec(select(EvalChats).where(EvalChats.id == eval_chat_id)).one()

        # get all the messages for the chat_id, order by created_at
        messages = session.exec(
            select(EvalMessages)
            .where(EvalMessages.chat_id == eval_chat_id)
            .order_by(EvalMessages.created_at)
        ).all()

        # prepare conversation history from chat_id
        conversation_history = get_conversation_history(messages)

        eval_run_id = chat.eval_run_id

        # get the rubric from the eval_run_id
        eval_run = session.exec(
            select(EvalRuns).where(EvalRuns.id == eval_run_id)
        ).one()

        rubric_id = eval_run.rubric_id

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
            f"Starting evaluation for chat {eval_chat_id} with rubric {rubric.name}"
        )
        logger.info(
            f"Found {len(standard_groups)} standard groups and {len(standards)} standards"
        )

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(rubric, standard_groups, standards)

        # Create dynamic Pydantic model for the rubric
        DynamicRubric = create_dynamic_rubric_model(standard_groups)

        # Log the expected field names for debugging
        expected_fields = []
        for group in standard_groups:
            safe_name = create_safe_field_name(group.short_name)
            expected_fields.extend([f"{safe_name}_score", f"{safe_name}_feedback"])
        logger.info(f"Expected model fields: {expected_fields}")

        # Create and run the evaluation agent
        evaluate_agent = EvaluateAgent()
        agent = evaluate_agent.agent(DynamicRubric)

        # Prepare input with rubric and conversation history
        input_items = [rubric_input] + conversation_history

        # Run the evaluation
        logger.info("Running evaluation agent...")
        result = await Runner.run(agent, input=input_items)
        evaluation_result = result.final_output_as(DynamicRubric)
        logger.info("Evaluation agent completed successfully")

        # Calculate time taken
        current_time = datetime.now()
        chat_created_at = chat.created_at

        # Ensure both times have the same timezone information
        if chat_created_at.tzinfo is not None:
            current_time = current_time.replace(tzinfo=chat_created_at.tzinfo)
        elif current_time.tzinfo is not None:
            chat_created_at = chat_created_at.replace(tzinfo=current_time.tzinfo)

        time_taken = max(0, int((current_time - chat_created_at).total_seconds()))

        # Extract overall evaluation data
        overall_score = evaluation_result.overall_score
        passed = evaluation_result.passed

        logger.info(f"Evaluation results: score={overall_score}, passed={passed}")

        # Create the eval chat grade record
        eval_chat_grade = EvalChatGrades(
            passed=passed,
            score=overall_score,
            time_taken=time_taken,
            rubric_id=rubric_id,
            eval_chat_id=eval_chat_id,
        )

        session.add(eval_chat_grade)
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
                group_score = getattr(evaluation_result, score_field, 0)
                group_feedback = getattr(evaluation_result, feedback_field, "")

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
                    eval_chat_feedback = EvalChatFeedbacks(
                        standard_id=matching_standard.id,
                        eval_chat_grade_id=eval_chat_grade.id,
                        total=group_score,
                        feedback=group_feedback,
                    )
                    session.add(eval_chat_feedback)
                    feedback_count += 1
                else:
                    logger.warning(
                        f"No matching standard found for group {group.short_name} with score {group_score}"
                    )

            except AttributeError as e:
                logger.error(
                    f"Failed to get evaluation data for group {group.short_name}: {e}"
                )
                continue

        logger.info(f"Created {feedback_count} feedback records")

        # Mark chat as completed
        chat.completed_at = current_time
        session.add(chat)

        # Commit all changes
        session.commit()
        session.refresh(eval_chat_grade)

        logger.info(
            f"Evaluation completed successfully with grade ID: {eval_chat_grade.id}"
        )
        return str(eval_chat_grade.id)

    except Exception as e:
        logger.error(f"Error in run_evaluate_agent: {str(e)}", exc_info=True)
        session.rollback()
        raise


class EvaluateAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = """You are an expert evaluator tasked with assessing conversations based on provided rubrics. 

Your role is to:
1. Carefully analyze the conversation between participants
2. Apply the rubric criteria objectively and consistently
3. Provide specific, actionable feedback for each criterion
4. Assign appropriate scores based on the evidence in the conversation
5. Determine if the overall performance meets the passing threshold

For each criterion:
- Review the conversation for evidence related to that criterion
- Match the performance to the appropriate rating level (1-5)
- Provide specific feedback citing examples from the conversation
- Keep feedback concise but specific (1-2 sentences)

Your evaluation should be fair, consistent, and based solely on observable evidence in the conversation."""

    def agent(self, output_type: type[BaseModel]):
        return Agent(
            name="Evaluate Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
            output_type=output_type,
        )
