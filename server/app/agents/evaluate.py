from app.db import get_session
from sqlmodel import Session
from app.models import Chats, Rubrics
from fastapi import Depends
import logging
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history
from sqlmodel import select
from app.models import Messages
from app.utils.rubric import get_rubric
from pydantic import BaseModel
from datetime import datetime

logger = logging.getLogger(__name__)


async def run_evaluate_agent(
    chat_id: str, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the evaluate agent.
    Returns a string of the rubric id.

    Args:
        chat_id: The ID of the chat session

    Returns:
        A string of the rubric id.
    """

    # get the chat from the chat_id
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()

    # get all the messages for the chat_id, order by created_at
    messages = session.exec(
        select(Messages)
        .where(Messages.chat_id == chat_id)
        .order_by(Messages.created_at)
    ).all()

    # prepare conversation history from chat_id
    conversation_history = get_conversation_history(messages)
    rubric = get_rubric()

    evaluate_agent = EvaluateAgent()
    input_items = [rubric] + conversation_history

    result = await Runner.run(evaluate_agent.agent(), input=input_items)
    rubric = result.final_output_as(Rubric)

    active_listening = rubric.listen
    active_listening_feedback = rubric.listen_fb
    course_objectives = rubric.obj
    course_objectives_feedback = rubric.obj_fb
    time_management = rubric.time
    time_management_feedback = rubric.time_fb
    adaptability = rubric.adapt
    adaptability_feedback = rubric.adapt_fb
    score = adaptability + active_listening + course_objectives + time_management
    passed = (
        score >= 17
        and active_listening >= 3
        and course_objectives >= 3
        and time_management >= 3
        and adaptability >= 3
    )

    # get the time taken in seconds. Subtract the created_at of the chat from the current time
    current_time = datetime.now()
    chat_created_at = chat.created_at

    # Ensure both times have the same timezone information
    if chat_created_at.tzinfo is not None:
        # If chat_created_at has timezone info, make current_time aware
        current_time = current_time.replace(tzinfo=chat_created_at.tzinfo)
    elif current_time.tzinfo is not None:
        # If current_time has timezone and chat_created_at doesn't, make chat_created_at aware
        chat_created_at = chat_created_at.replace(tzinfo=current_time.tzinfo)

    time_taken = max(0, (current_time - chat_created_at).total_seconds())

    # create a rubric
    rubric = Rubrics(
        chat_id=chat_id,
        passed=passed,
        score=score,
        time_taken=time_taken,
        adaptability=adaptability,
        listening=active_listening,
        listening_feedback=active_listening_feedback,
        objectives=course_objectives,
        objectives_feedback=course_objectives_feedback,
        time_management=time_management,
        time_management_feedback=time_management_feedback,
        adaptability_feedback=adaptability_feedback,
    )

    session.add(rubric)

    chat.completed = True
    session.add(chat)

    session.commit()
    session.refresh(chat)

    logger.info(f"Rubric created with ID: {rubric.id}")
    return rubric.id


class Rubric(BaseModel):
    listen: int  # listening
    listen_fb: str
    obj: int  # course objectives
    obj_fb: str
    time: int  # time management
    time_fb: str
    adapt: int  # adaptability
    adapt_fb: str


class EvaluateAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = "Your purpose is to evaluate a conversation between a student and a GTA, grading them on the following metrics (from 1-5): listening, course objectives, time management, and adaptability. A rubric will be provided to you to help guide the responses. Output a JSON object with the following fields: listen, obj, time, adapt. You should also provide feedback for each metric to let the GTA know how to improve. Please keep this feedback concise, not more than 1-2 sentences. The feedback should be specific and measureable, like 'Recursion was explained incorrectly' or 'Ask more questions about min heaps, don't just give the definition'. You can use listen_fb, obj_fb, time_fb, and adapt_fb to provide feedback for each metric."

    def agent(self):
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
            output_type=Rubric,
        )
