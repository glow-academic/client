from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Document, Quiz
from app.utils import logger

router = APIRouter()

@router.get("/{document_id}/references")
async def get_document_references(document_id: str, db: Session = Depends(get_db)):
    """
    Check if a document is referenced by any quizzes or other entities
    """
    try:
        # Check if the document exists
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return JSONResponse(
                status_code=404,
                content={"message": "Document not found"}
            )
            
        # Check for quizzes that reference this document
        referencing_quizzes = db.query(Quiz).filter(Quiz.document_id == document_id).all()
        
        return {
            "document_id": document_id,
            "references": {
                "quizzes": [
                    {
                        "id": quiz.id,
                        "title": quiz.title
                    } for quiz in referencing_quizzes
                ]
            }
        }
    except Exception as e:
        logger.error(f"Error checking document references: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": f"Error checking document references: {str(e)}"}
        )

# Update the delete endpoint to handle force deletion
@router.delete("/id/{document_id}")
async def delete_document(
    document_id: str,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Delete a document by ID
    
    If force=True, any quizzes referencing this document will have their document_id set to NULL
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return JSONResponse(
                status_code=404, 
                content={"message": "Document not found"}
            )
            
        # If force is True, handle quiz references
        if force:
            # Update any quizzes that reference this document to NULL
            db.query(Quiz).filter(Quiz.document_id == document_id).update(
                {"document_id": None}, synchronize_session=False
            )
            
        # Delete the document
        db.delete(document)
        db.commit()
        
        return {"message": "Document deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting document: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"message": f"Failed to delete document: {str(e)}"}
        )