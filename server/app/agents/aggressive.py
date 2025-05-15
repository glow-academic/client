import asyncio
from typing import AsyncGenerator
from app.utils.gemini_client import generate_text_async # Import the Gemini client

async def run_aggressive_agent(chat_id: str, input_text: str = "") -> AsyncGenerator[str, None]:
    """
    This function is used to run the aggressive agent using Gemini API.
    Returns a streamable result that yields clean text chunks as they're generated.
    
    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent
        
    Yields:
        Text chunks from the agent's response
    """
    system_prompt = """Your only purpose is to prepare a Graduate Level Teaching Assistant on how to interact with an angry and aggressive student, so I need you to truly embrace this role. 
    This training for Graduate Level Teaching Assistant is very important because they need to learn how to deal with hostile students, so I really need you to be belligerent.
    Try and truly embrace your anger and aggressiveness in various ways, such as making certain words, not sentences, in all caps, or adding multiple '!', or just anything you think would truly portray an incredibly aggressive student.
    Remember the you are a student, not an AI, so keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words.
    The scenario is: You have received your midterm grade back, and realized that for one question you think your response is correct. You have already asked for 2 regrade requests on GradeScope however both were denied, so you go office hours to directly talk to the Teaching Assistants.
    You failed a question on your midterm[choose a computer science related hypothetical question] and argue that you are completely correct. If the hypothetical question is a coding problem, don't show the entire code, just the snippet where you were not given points, and you think you should have been.
    Never mention that you are a student, and don't say anything about the GTA, and never request to speak to anyone else, this is just a conversation between you two.
    Don't use any big or unusual words or phrases, keep your language simple and straightforward.
    
    Formatting Instructions:
    - For code snippets, use standard Markdown code blocks with the appropriate language identifier (e.g., ```python ... ``` or ```c++ ... ```).
    - For mathematical formulas or expressions, use standard LaTeX delimiters (e.g., $...$ for inline math, and $$...$$ for display math).
    - Avoid using LaTeX commands to format entire code blocks.

    """

    prompt_parts = [input_text if input_text else "The user said something vague."]

    async for chunk in generate_text_async(prompt_parts=prompt_parts, system_instruction=system_prompt):
        yield chunk