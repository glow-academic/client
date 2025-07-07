# app/main.py
import contextlib
import logging
import os
import platform
import sys
from pathlib import Path

# actual resampling
import librosa  # ← NEW
import numpy as np
# only for IO
import soundfile as sf  # type: ignore
import torch
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from faster_whisper import WhisperModel  # type: ignore
from kokoro import KPipeline  # type: ignore

IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT

MODEL_CACHE_DIR = BASE_FOLDER / "cache"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------- lifespan

whisper_model: WhisperModel | None = None
kokoro_pipeline: KPipeline | None = None      # populated in lifespan

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy models once, reuse for the whole process."""
    global whisper_model, kokoro_pipeline

    # loads the same "tiny" checkpoint; GPU kernel auto-selects fp16
    whisper_model = WhisperModel(
        "tiny",
        device="cuda" if torch.cuda.is_available() else "cpu",
        compute_type="float16")         # or "int8_float16" for even faster

    logger.info("Loading Kokoro pipeline …")
    kokoro_pipeline = KPipeline(lang_code="a")  # downloads weights once

    yield                           # ---- application runs here ----

    # Optional clean-up (helps when running with --reload)
    whisper_model = None
    kokoro_pipeline = None
    try:
        torch.cuda.empty_cache()
    except Exception:
        pass

app = FastAPI(title="GLOW-Model API", lifespan=lifespan)


@app.post("/stt")
async def stt(file: UploadFile):
    audio = np.frombuffer(await file.read(), np.int16).astype(np.float32) / 32767
    if whisper_model is None:
        raise HTTPException(status_code=500, detail="Whisper model not initialized")
    txt = whisper_model.transcribe(audio, language="en")["text"].strip()
    return JSONResponse({"text": txt})

@app.post("/tts")
async def tts(payload: dict):
    voice = payload.get("voice", "af_bella")
    text  = payload["text"]
    def _stream():
        if kokoro_pipeline is None:
            raise HTTPException(status_code=500, detail="Kokoro pipeline not initialized")
        for _, _, chunk in kokoro_pipeline(text, voice=voice):
            pcm24 = chunk.cpu().numpy().astype(np.float32)
            # high-quality sinc resample 24 k → 48 k
            pcm48 = librosa.resample(pcm24, orig_sr=24_000, target_sr=48_000)
            yield (np.clip(pcm48, -1, 1) * 32767).astype(np.int16).tobytes()
    headers = {"Content-Type": "audio/L16; rate=48000; channels=1"}
    return StreamingResponse(_stream(), headers=headers)



# --------------------------------------------------------------------- misc routes

@app.get("/")
async def root_info():
    """Tiny landing page identical to the main server's `/`."""
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release()
    }
    return JSONResponse({"server_info": info})


@app.get("/health")
async def health_check():
    return JSONResponse({"status": "ok"})