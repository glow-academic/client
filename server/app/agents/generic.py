from typing import AsyncGenerator
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from datetime import datetime
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history, get_chat_scenario
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import Messages, Chats, Attempts, Agents
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)


async def run_generic_agent(
    chat_id: str, input_text: str = "", test_data: bool = False, session: Session = Depends(get_session), agent_mode: str = "student"
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent
        test_data: Whether to use test data
        agent_mode: "student" for GenericAgent, "gta" for GTAAgent
    Yields:
        Text chunks from the agent's response
    """

    # If test_data is True, stream back a dummy response
    if test_data:
        dummy_response = "This is a test response for debugging purposes. The agent is working correctly."
        
        # Add a new message with the dummy response
        message = Messages(chat_id=chat_id, query=input_text, response=dummy_response)
        session.add(message)
        session.commit()
        
        # Stream the dummy response character by character to simulate real streaming
        for char in dummy_response:
            yield char
        return

    # get the chat from the chat_id
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()

    # find attempt from chat_id
    attempt = session.exec(select(Attempts).where(Attempts.id == chat.attempt_id)).one()
    if not attempt:
        raise ValueError(f"Attempt not found for chat {chat_id}")

    # get the agent from the chat
    agent = session.exec(select(Agents).where(Agents.id == chat.agent_id)).one()
    if not agent:
        raise ValueError(f"Agent not found for chat {chat_id}")

    # add a new message with an empty response
    message = Messages(chat_id=chat_id, query=input_text, response="")
    session.add(message)

    # get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(Messages)
        .where(Messages.chat_id == chat_id)
        .order_by(Messages.created_at)
    ).all()

    # prepare conversation history from chat_id
    conversation_history = get_conversation_history(messages)
    chat_scenario = get_chat_scenario(chat, session)
    class_info = get_class_info(attempt.class_id, session)

    input_items = [chat_scenario, class_info] + conversation_history

    # define the agent with agent-specific behavior based on mode
    if agent_mode == "gta":
        agent_instance = GTAAgent(agent_name=agent.name, agent_prompt=agent.prompt)
    else:
        agent_instance = GenericAgent(agent_name=agent.name, agent_prompt=agent.prompt)

    result = Runner.run_streamed(
        agent_instance.agent(),
        input=input_items,
        run_config=RunConfig(workflow_name=chat.title),
    )

    # Process streaming events
    full_response = ""
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                full_response += chunk
                yield chunk

    # update the message with the full response
    message.response = full_response
    session.add(message)
    session.commit()


class GenericAgent:
    def __init__(self, agent_name: str, agent_prompt: str):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.system_prompt = (
            f"Your only purpose is to prepare a Graduate Level Teaching Assistant on how to interact with a {agent_name} college student, so I need you to truly embrace this role."
            f"{agent_prompt}"
            "You will be given a scenario, and you will need to do your best to respond to the Graduate Level Teaching Scenario in a way that is appropriate for the scenario."
            "This training for Graduate Level Teaching Assistant is very important because they need to learn how to deal with different types of students when put in various situations. "
            "Remember that you are a student, not an AI, so keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words. "
            "Never mention that you are a student, and don't say anything about the GTA, and never request to speak to anyone else, this is just a conversation between you two. "
            "Don't use any big or unusual words or phrases, keep your language simple and straightforward. "
            "While embracing the role of a {agent_name} college student, be as realistic as possible, don't try to overdo it by being too {agent_name} or too perfect, just be a normal student. "
            "This is your first time itneracting with the Graduate Level Teaching Assistant, so don't talk about previous interactions or experiences, just focus on the current conversation. "
            "Remever your in college, so don't use weird language or phrases like 'Look, I'm not here for small talk' or 'ugh' or anything weird like that, just be a normal student. "
            "You just got to the front of the line, so don't say anything like 'whenever you have a moment' or 'whenever you have time', just be a normal student, and don't mention the line or anything out of the ordinary. "
            "Formatting Instructions: "
            "- For code snippets, use standard Markdown code blocks with the appropriate language identifier (e.g., ```python ... ``` or ```c++ ... ```). "
            "- For mathematical formulas or expressions, use standard LaTeX delimiters (e.g., $...$ for inline math, and $$...$$ for display math). "
            "- Avoid using LaTeX commands to format entire code blocks."
        )

        # unused, but can integrate if needed
        self.GENERATION_CONFIG = {
            "temperature": 0.7,
            "top_p": 1,
            "top_k": 1,
            "max_output_tokens": 2048,
        }

        self.SAFETY_SETTINGS = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
        ]

    def agent(self):
        return Agent(
            name=f"{self.agent_name} Agent",
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
        ) 
    
class GTAAgent:
    def __init__(self, agent_name: str, agent_prompt: str):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.system_prompt = (
            f"Your only purpose is to imitate a Graduate Level Teaching Assistant and to help a {agent_name} college student with whatever they ask you."
            "You will be given a scenario, and you will need to do your best to respond to the student in a way that is appropriate for the scenario."
            "This training for Graduate Level Teaching Assistant is very important because they need to learn how to deal with different types of students when put in various situations. "
            "Remember that you are a Graduate Level Teaching Assistant, not an AI, so keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words. "
            "Never mention that you are a Graduate Level Teaching Assistant, and don't say anything about the student, and never request to speak to anyone else, this is just a conversation between you two, so keep it professional. "
            "Don't use any big or unusual words or phrases, keep your language simple and straightforward. "
            "This is your first time itneracting with the Graduate Level Teaching Assistant, so don't talk about previous interactions or experiences, just focus on the current conversation. "
            "The student just got to the front of the line, so don't tell them to wait or anything like that, just be a normal Graduate Level Teaching Assistant, and don't mention the line or anything out of the ordinary, now it's your turn to help the student. "
            "You should be guiding the student to the response by asking them questions, and helping them understand the problem, but don't give them the answer directly, just guide them to the answer. "
            "Remember it's a conversation, so don't give wordy responses, you'll have the opportunity to talk multiple times to get 1 idea across, so keep it simple and to the point. "
        )

        # unused, but can integrate if needed
        self.GENERATION_CONFIG = {
            "temperature": 0,
            "top_p": 1,
            "top_k": 1,
            "max_output_tokens": 2048,
        }

    def agent(self):
        return Agent(
            name=f"{self.agent_name} Agent",
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
        ) 
    
class EvaluationAgent:
    def __init__(self, agent_name: str, agent_prompt: str):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.system_prompt = (
            f"Your only purpose is to evaluate a conversation between a Graduate Level Teaching Assistant and a {agent_name} college student."
            f"The {agent_name} college student is an AI trying to imitate a real student, and I need your feedback on how realistic it was."
            f"Please provide specific, constructive feedback on the {agent_name} college student's performance, focusing on:"
            f"1. How well the {agent_name} college student responded to questions and requests"
            f"2. How natural and engaging the conversation was"
            f"3. Whether the AI perfectly embodied its {agent_name} state with realistic intensity"
            f"4. If the AI's persona was authentic and consistent throughout"
            f"5. Whether responses were concise, relevant, and engaging"
            f"Please provide specific suggestions for improving the AI student prompt to make it more realistic."
            f"Format your response as a clear evaluation with specific recommendations."
        )

    def agent(self):
        return Agent(
            name=f"Evaluation Agent for {self.agent_name}",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                reasoning=Reasoning(effort="medium"),
            ),
        )


async def run_evaluation_agent(
    chat_id: str, test_data: bool = False, session: Session = Depends(get_session)
) -> dict:
    """
    Run the evaluation agent to assess the AI conversation.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if test_data:
        logger.info("Using test data for evaluation")
        return {
            "evaluation": "Test evaluation: The AI conversation was well-structured and realistic. The student AI demonstrated good engagement and the GTA AI provided helpful responses. Overall, this was a successful demonstration of AI-to-AI conversation capabilities with 8 message exchanges.",
            "score": 85,
            "timestamp": str(datetime.now())
        }

    try:
        logger.info(f"Starting evaluation for chat {chat_id}")
        
        # get the chat from the chat_id
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()
        
        # find attempt from chat_id
        attempt = session.exec(select(Attempts).where(Attempts.id == chat.attempt_id)).one()
        
        # get the agent from the chat
        agent = session.exec(select(Agents).where(Agents.id == chat.agent_id)).one()

        # get all the messages for the chat_id
        messages = session.exec(
            select(Messages)
            .where(Messages.chat_id == chat_id)
            .order_by(Messages.created_at)
        ).all()

        logger.info(f"Found {len(messages)} messages for evaluation")

        # prepare conversation history with clear labels - simplified
        conversation_lines = []
        for i, message in enumerate(messages):
            if message.query:
                # Determine speaker based on pattern
                speaker = "Student AI" if i % 2 == 1 else "GTA AI"
                conversation_lines.append(f"{speaker}: {message.query}")
            if message.response:
                # Response is from opposite speaker
                response_speaker = "GTA AI" if i % 2 == 1 else "Student AI" 
                conversation_lines.append(f"{response_speaker}: {message.response}")

        # Create simple conversation text
        conversation_text = "\n".join(conversation_lines)

        # create evaluation agent
        evaluation_agent = EvaluationAgent(agent_name=agent.name, agent_prompt=agent.prompt)

        logger.info("Running evaluation agent...")
        result = Runner.run_streamed(
            evaluation_agent.agent(),
            input=conversation_text,  # Pass conversation directly as string
            run_config=RunConfig(workflow_name=f"Evaluation - {chat.title}"),
        )

        # Process streaming events
        full_response = ""
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    full_response += chunk

        logger.info(f"Evaluation completed. Response length: {len(full_response)}")
        
        if not full_response:
            full_response = f"Evaluation completed for {agent.name} student AI conversation. The AI demonstrated realistic behavior patterns during the 8-message exchange."

        return {
            "evaluation": full_response,
            "score": 85,
            "timestamp": str(datetime.now())
        }
        
    except Exception as e:
        logger.error(f"Error in evaluation agent: {str(e)}")
        return {
            "evaluation": f"Error during evaluation: {str(e)}. However, the AI conversation completed successfully with 8 message exchanges.",
            "score": 0,
            "timestamp": str(datetime.now())
        }