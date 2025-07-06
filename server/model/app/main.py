# app/main.py
import os
from pathlib import Path

import numpy as np
import soundfile as sf  # type: ignore
import torch
import whisper  # type: ignore
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from kokoro import KPipeline  # type: ignore

IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT

MODEL_CACHE_DIR = BASE_FOLDER / "cache"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True) # for whisper model

app = FastAPI()
whisper_model: whisper.Whisper | None = None
kokoro_pipeline: KPipeline | None = None

@app.on_event("startup")
def _warm_models():
    global whisper_model, kokoro_pipeline
    device = "cuda" if torch.cuda.is_available() else "cpu"
    whisper_model  = whisper.load_model(
        "tiny", download_root=str(MODEL_CACHE_DIR)
    ).to(device).eval()
    kokoro_pipeline = KPipeline(lang_code="a")        # downloads TTS weights once


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
            pcm48 = sf.resample(pcm24, 24000, 48000, 'sinc_best')
            yield (np.clip(pcm48, -1, 1) * 32767).astype(np.int16).tobytes()
    headers = {"Content-Type": "audio/L16; rate=48000; channels=1"}
    return StreamingResponse(_stream(), headers=headers)
