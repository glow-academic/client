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


@router.delete("/id/{message_id}")
async def delete_audio(
    message_id: str,
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Delete an audio by its ID - removes both database entry and file from filesystem
    """
    try:
        # Query the document
        query = select(SimulationMessages).where(SimulationMessages.id == message_id)
        message = session.exec(query).first()

        if not message:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"Audio with ID {message_id} not found",
                },
            )

        # Get the file path and ensure it's the full path
        db_file_path = message.file_path
        if not db_file_path:
            raise HTTPException(status_code=404, detail="Audio file not found")

        upload_folder_str = str(AUDIO_FOLDER)

        # If the path doesn't start with the UPLOAD_FOLDER, prepend it
        full_file_path = db_file_path
        if not str(db_file_path).startswith(upload_folder_str):
            full_file_path = os.path.join(upload_folder_str, db_file_path)

        logger.info(f"Attempting to delete file: {full_file_path}")

        # Delete the file from the filesystem if it exists
        if os.path.exists(full_file_path):
            try:
                os.remove(full_file_path)
                logger.info(f"Deleted file from filesystem: {full_file_path}")
            except Exception as e:
                logger.error(f"Error deleting file {full_file_path}: {str(e)}")
        else:
            logger.warning(f"File not found in filesystem: {full_file_path}")

        # Delete the document from the database
        session.delete(message)
        session.commit()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"Audio {message_id} deleted successfully",
            },
        )

    except Exception as e:
        logger.error(f"Error deleting audio: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to delete audio: {str(e)}",
            },
        )
