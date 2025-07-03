import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

# Detect container vs. host **without** relying on a .env entry
IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True) # saving each document as uploads/document_id.ext

AUDIO_FOLDER = BASE_FOLDER / "audio"
AUDIO_FOLDER.mkdir(parents=True, exist_ok=True) # saving each audio file as audio/message_id.ext

SKETCH_FOLDER = BASE_FOLDER / "sketches"
SKETCH_FOLDER.mkdir(parents=True, exist_ok=True) # saving each sketch as sketches/message_id.ext

MODEL_CACHE_DIR = BASE_FOLDER / "cache"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True) # for whisper model