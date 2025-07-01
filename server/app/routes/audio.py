# app/routes/document.py
import logging
import os

from app.db import get_session
from app.extensions import AUDIO_FOLDER
from app.models import SimulationMessages
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()

# Get audio for message by ID
@router.get("/id/{message_id}")
async def get_audio(
    message_id: str,
    session: Session = Depends(get_session),
) -> FileResponse:
    """
    Retrieve an audio file for a message by its ID
    """
    # Query the message
    query = select(SimulationMessages).where(SimulationMessages.id == message_id)
    result = session.exec(query).first()

    if not result:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if not result.audio or not result.file_path:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Construct the full file path
    file_path = os.path.join(AUDIO_FOLDER, result.file_path)

    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Return the file as a response
    return FileResponse(
        path=file_path, filename=result.file_path, media_type="audio/wav"
    )
