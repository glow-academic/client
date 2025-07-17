# app/routes/csv.py
import logging
import os

from app.db import get_session
from app.extensions import CSV_FOLDER
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter()


# Get CSV for token
@router.get("/token/{token}")
async def get_csv(
    token: str,
    session: Session = Depends(get_session),
) -> FileResponse:
    """
    Retrieve a CSV file for a token
    """
    # Construct the full file path
    file_path = os.path.join(CSV_FOLDER, f"{token}.csv")

    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CSV file not found")

    # Return the file as a response
    return FileResponse(
        path=file_path,
        filename=f"{token}.csv",
        media_type="text/csv",
    )
