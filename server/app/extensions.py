from pathlib import Path
import os, logging
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

# Detect container vs. host **without** relying on a .env entry
IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER  = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)      # idempotent & safe

# ---- Gemini ---------------------------------------------------------
logger = logging.getLogger(__name__)
_gemini: AsyncOpenAI | None = None

def _init_gemini() -> None:
    global _gemini
    key = os.getenv("GOOGLE_API_KEY")
    if key and _gemini is None:
        _gemini = AsyncOpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=key,
        )
    elif _gemini is None:
        logger.warning("GOOGLE_API_KEY missing – Gemini features disabled")

def get_gemini() -> AsyncOpenAI | None:
    if _gemini is None:
        _init_gemini()
    return _gemini