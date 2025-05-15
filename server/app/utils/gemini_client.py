import os
import asyncio
import logging
import google.generativeai as genai
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# Load the API key from environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY environment variable not set.")
    # You might want to raise an error or handle this more gracefully
    # For now, we'll let it proceed, but genai.configure will likely fail.
else:
    genai.configure(api_key=GOOGLE_API_KEY)

# Configuration for the Gemini model
GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]

async def generate_text_async(prompt_parts: list, system_instruction: str = None) -> AsyncGenerator[str, None]:
    """
    Generates text using the Gemini API asynchronously and streams the response.

    Args:
        prompt_parts: A list of strings forming the prompt.
        system_instruction: An optional system instruction for the model.

    Yields:
        str: Chunks of the generated text.
    """
    if not GOOGLE_API_KEY:
        yield "Error: GOOGLE_API_KEY not configured."
        return

    try:
        model_kwargs = {
            "generation_config": GENERATION_CONFIG,
            "safety_settings": SAFETY_SETTINGS,
        }
        if system_instruction:
            model_kwargs["system_instruction"] = system_instruction
        
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash", # Or "gemini-pro"
            **model_kwargs
        )
        
        # The Gemini Python SDK's generate_content with stream=True is synchronous.
        # To make it truly async and non-blocking for FastAPI, run in a thread.
        response = await asyncio.to_thread(
            model.generate_content,
            prompt_parts,
            stream=True
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text
            await asyncio.sleep(0.01) # Yield control to event loop

    except Exception as e:
        logger.error(f"Error generating text with Gemini: {e}")
        yield f"Error: Could not generate response from Gemini. Details: {str(e)}"

async def generate_text_non_stream_async(prompt_parts: list, system_instruction: str = None) -> str:
    """
    Generates text using the Gemini API asynchronously (non-streaming).

    Args:
        prompt_parts: A list of strings forming the prompt.
        system_instruction: An optional system instruction for the model.

    Returns:
        str: The full generated text.
    """
    if not GOOGLE_API_KEY:
        return "Error: GOOGLE_API_KEY not configured."

    try:
        model_kwargs = {
            "generation_config": GENERATION_CONFIG,
            "safety_settings": SAFETY_SETTINGS,
        }
        if system_instruction:
            model_kwargs["system_instruction"] = system_instruction

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
             **model_kwargs
        )
        
        response = await asyncio.to_thread(
            model.generate_content,
            prompt_parts
        )
        return response.text
    except Exception as e:
        logger.error(f"Error generating non-streaming text with Gemini: {e}")
        return f"Error: Could not generate non-streaming response from Gemini. Details: {str(e)}"
