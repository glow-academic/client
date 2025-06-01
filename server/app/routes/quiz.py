# app/routes/quiz.py
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from app.db import get_session
from sqlmodel import Session, select
from app.models import Quizzes, QuizAttempts, Documents, Users, Classes
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from sqlalchemy.orm import joinedload
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class QuizCreate(BaseModel):
    title: str
    classId: str
    documentId: Optional[str] = None
    timeLimit: int
    studentInteractions: Dict[str, List[Dict[str, Any]]]

class QuizUpdate(QuizCreate): # Can inherit from QuizCreate if fields are the same
    pass

# Define Pydantic models for response serialization
class DocumentResponse(BaseModel):
    id: UUID
    name: str
    file_path: str
    mime_type: str
    profile: Optional[str] = None
    class_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True

class ClassResponse(BaseModel):
    id: UUID
    name: str
    class_code: str

    class Config:
        orm_mode = True
        from_attributes = True

class QuizDetailResponse(BaseModel):
    id: UUID
    title: str
    time_limit: int
    student_interactions: Dict[str, List[Dict[str, Any]]]
    created_at: datetime
    document: Optional[DocumentResponse] = None
    class_: Optional[ClassResponse] = Field(None, alias="class") # Alias 'class_' to 'class' in JSON

    # Add other fields from Quizzes model that might be needed by frontend's getQuiz transformation
    active: bool 
    # creator_id: UUID # If needed

    class Config:
        orm_mode = True
        allow_population_by_field_name = True # Important for the alias
        from_attributes = True

class QuizResponse(BaseModel): # For lists of quizzes, simplified
    id: str
    title: str
    classId: str
    className: str
    documentId: str
    timeLimit: int
    aggressiveCount: int
    happyCount: int
    confusedCount: int
    createdAt: datetime

class QuizAttemptCreate(BaseModel):
    userId: str

# Helper function to get current user
async def get_current_user(request: Request, session: Session = Depends(get_session)):
    # For simplicity, assuming we have a user ID in the session
    # In a real app, this would use your authentication system
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = session.exec(select(Users).where(Users.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.post("/")
async def create_quiz(
    quiz_data: QuizCreate,
    session: Session = Depends(get_session)
):
    """Create a new quiz"""
    try:
        logger.info(f"Creating quiz with data: {quiz_data}")
        
        # Validate class exists
        class_obj = session.exec(select(Classes).where(Classes.id == quiz_data.classId)).first()
        if not class_obj:
            raise HTTPException(status_code=404, detail="Class not found")
            
        # Validate document exists if provided
        if quiz_data.documentId and quiz_data.documentId != "none":
            document = session.exec(select(Documents).where(Documents.id == quiz_data.documentId)).first()
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
        else:
            quiz_data.documentId = None
        
        # Create quiz with proper field mapping
        new_quiz = Quizzes(
            title=quiz_data.title,
            class_id=quiz_data.classId,
            document_id=quiz_data.documentId,
            time_limit=quiz_data.timeLimit,
            student_interactions=quiz_data.studentInteractions,
            creator_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"  # Default admin ID for now
        )
        
        session.add(new_quiz)
        session.commit()
        session.refresh(new_quiz)
        
        logger.info(f"Successfully created quiz with ID: {new_quiz.id}")
        return {"id": str(new_quiz.id), "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating quiz: {str(e)}")
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/{quiz_id}")
async def update_existing_quiz(
    quiz_id: str,
    quiz_data: QuizUpdate,
    session: Session = Depends(get_session)
):
    """Update an existing quiz"""
    try:
        logger.info(f"Updating quiz {quiz_id} with data: {quiz_data}")

        quiz_to_update = session.exec(select(Quizzes).where(Quizzes.id == quiz_id)).first()
        if not quiz_to_update:
            raise HTTPException(status_code=404, detail="Quiz not found")

        # Validate class exists
        class_obj = session.exec(select(Classes).where(Classes.id == quiz_data.classId)).first()
        if not class_obj:
            raise HTTPException(status_code=404, detail="Class not found")
            
        # Validate document exists if provided
        if quiz_data.documentId and quiz_data.documentId != "none": # "none" might come from frontend if not changed
            document = session.exec(select(Documents).where(Documents.id == quiz_data.documentId)).first()
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            quiz_to_update.document_id = quiz_data.documentId
        elif quiz_data.documentId is None or quiz_data.documentId == "none": # Explicitly set to null
             quiz_to_update.document_id = None
        # If documentId is not in quiz_data, it means it's not being updated, so we don't touch it.
        # However, QuizUpdate inherits QuizCreate which has documentId, so it will always be present.

        quiz_to_update.title = quiz_data.title
        quiz_to_update.class_id = quiz_data.classId
        quiz_to_update.time_limit = quiz_data.timeLimit
        quiz_to_update.student_interactions = quiz_data.studentInteractions
        # creator_id and active status are not typically updated here unless specified

        session.add(quiz_to_update)
        session.commit()
        session.refresh(quiz_to_update)
        
        logger.info(f"Successfully updated quiz with ID: {quiz_to_update.id}")
        # Return a structure similar to the get_quizzes response for consistency if needed,
        # or just a success message.
        return {"id": str(quiz_to_update.id), "success": True, "message": "Quiz updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating quiz {quiz_id}: {str(e)}")
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/")
def get_quizzes(db: Session = Depends(get_session)):
    """Get all quizzes"""
    quizzes = db.query(Quizzes).options(
        joinedload(Quizzes.class_),
        joinedload(Quizzes.document),
        joinedload(Quizzes.creator)
    ).all()
    
    result = []
    for quiz in quizzes:
        # Calculate student counts from the student_interactions JSONB
        student_interactions = quiz.student_interactions or {}
        aggressive_students = student_interactions.get("aggressive", [])
        happy_students = student_interactions.get("happy", [])
        confused_students = student_interactions.get("confused", [])
        
        result.append({
            "id": str(quiz.id),
            "title": quiz.title,
            "classId": str(quiz.class_id),
            "className": quiz.class_.name if quiz.class_ else None,
            "classCode": quiz.class_.class_code if quiz.class_ else None,
            "documentId": str(quiz.document_id) if quiz.document_id else None,
            "documentName": quiz.document.name if quiz.document else None,
            "timeLimit": quiz.time_limit,
            "createdAt": quiz.created_at,
            "creatorId": str(quiz.creator_id),
            "creatorName": quiz.creator.name if quiz.creator else None,
            "active": quiz.active,
            "studentInteractions": quiz.student_interactions,
            # Calculated fields for compatibility
            "aggressiveCount": len(aggressive_students),
            "happyCount": len(happy_students),
            "confusedCount": len(confused_students),
            "totalStudents": len(aggressive_students) + len(happy_students) + len(confused_students)
        })
    
    return result

@router.get("/{quiz_id}", response_model=QuizDetailResponse)
async def get_quiz_by_id(quiz_id: str, session: Session = Depends(get_session)):
    """Get a single quiz by its ID"""
    try:
        quiz = session.exec(
            select(Quizzes)
            .options(
                joinedload(Quizzes.class_),
                joinedload(Quizzes.document),
                joinedload(Quizzes.creator) # Though creator is not in QuizDetailResponse, good to load if needed later
            )
            .where(Quizzes.id == quiz_id)
        ).first()

        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        class_data = ClassResponse.from_orm(quiz.class_) if quiz.class_ else None
        document_data = DocumentResponse.from_orm(quiz.document) if quiz.document else None
        
        # Ensure student_interactions is a dict, even if None in DB
        student_interactions_data = quiz.student_interactions if quiz.student_interactions is not None else {}


        return QuizDetailResponse(
            id=quiz.id,
            title=quiz.title,
            time_limit=quiz.time_limit,
            student_interactions=student_interactions_data,
            created_at=quiz.created_at,
            document=document_data,
            class_=class_data, # Pydantic will use the alias 'class' in the JSON output
            active=quiz.active
            # creator_id=quiz.creator_id # Add if needed
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching quiz {quiz_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/user/{user_id}")
async def get_quizzes_for_user(
    user_id: str,
    session: Session = Depends(get_session)
):
    """Get quizzes available for a specific user"""
    # Get the user
    user = session.exec(select(Users).where(Users.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # For regular users, get quizzes for their classes
    if not user.admin and user.classes:
        quizzes = session.exec(select(Quizzes).where(Quizzes.class_id.in_(user.classes), Quizzes.active == True)).all()
    # For admins or users without classes, get all active quizzes
    else:
        quizzes = session.exec(select(Quizzes).where(Quizzes.active == True)).all()
    
    result = []
    for quiz in quizzes:
        class_obj = session.exec(select(Classes).where(Classes.id == quiz.class_id)).first()
        
        # Calculate student counts from student_interactions
        student_interactions = quiz.student_interactions or {}
        aggressive_students = student_interactions.get("aggressive", [])
        happy_students = student_interactions.get("happy", [])
        confused_students = student_interactions.get("confused", [])

        # Check if user has attempted this quiz
        attempts = session.exec(
            select(QuizAttempts).where(
                QuizAttempts.quiz_id == quiz.id,
                QuizAttempts.user_id == user_id
            ).order_by(QuizAttempts.started_at.desc())
        ).all()
        
        latest_attempt = attempts[0] if attempts else None
        
        result.append({
            "id": str(quiz.id),
            "title": quiz.title,
            "classId": str(quiz.class_id),
            "className": class_obj.class_code if class_obj else "Unknown",
            "documentId": str(quiz.document_id) if quiz.document_id else None, # Added if quiz.document_id exists
            "timeLimit": quiz.time_limit,
            "aggressiveCount": len(aggressive_students), # Correctly calculated
            "happyCount": len(happy_students), # Correctly calculated
            "confusedCount": len(confused_students), # Correctly calculated
            "createdAt": quiz.created_at,
            "lastAttempt": {
                "id": str(latest_attempt.id),
                "completed": latest_attempt.completed,
                "score": latest_attempt.score,
                "startedAt": latest_attempt.started_at,
                "completedAt": latest_attempt.completed_at
            } if latest_attempt else None
        })
    
    return result

@router.post("/{quiz_id}/start")
async def start_quiz_attempt(
    quiz_id: str,
    data: QuizAttemptCreate = Body(...),
    session: Session = Depends(get_session)
):
    """Start a new quiz attempt"""
    # Validate quiz exists and is active
    quiz = session.exec(select(Quizzes).where(Quizzes.id == quiz_id, Quizzes.active == True)).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or inactive")
    
    # Validate user exists
    user = session.exec(select(Users).where(Users.id == data.userId)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has an incomplete attempt
    incomplete_attempt = session.exec(
        select(QuizAttempts).where(
            QuizAttempts.quiz_id == quiz_id,
            QuizAttempts.user_id == data.userId,
            QuizAttempts.completed == False
        )
    ).first()
    
    if incomplete_attempt:
        return {
            "attemptId": str(incomplete_attempt.id),
            "message": "Continuing existing attempt"
        }
    
    # Create new attempt
    new_attempt = QuizAttempts(
        quiz_id=quiz_id,
        user_id=data.userId
    )
    
    session.add(new_attempt)
    session.commit()
    session.refresh(new_attempt)
    
    return {
        "attemptId": str(new_attempt.id),
        "message": "Quiz attempt started"
    }

@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: str,
    session: Session = Depends(get_session)
):
    """Delete a quiz (admin only)"""
    # For now, let's skip the admin check
    # if not current_user.admin:
    #     raise HTTPException(status_code=403, detail="Only admins can delete quizzes")
    
    quiz = session.exec(select(Quizzes).where(Quizzes.id == quiz_id)).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    session.delete(quiz)
    session.commit()
    
    return {"success": True}
