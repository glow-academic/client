import os
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize variables
gemini_client = None


# Initialize clients function - will be called explicitly when needed
def initialize_clients():
    global gemini_client
    # Creating the gemini client
    if os.getenv("GOOGLE_API_KEY") and gemini_client is None:
        gemini_client = AsyncOpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=os.getenv("GOOGLE_API_KEY"),
        )
    elif gemini_client is None and os.getenv("GOOGLE_API_KEY"):
        logger.warning(
            "Warning: Google API key not found, running without Gemini client"
        )


# Get gemini client
def get_gemini():
    global gemini_client
    if gemini_client is None:
        initialize_clients()
    return gemini_client
