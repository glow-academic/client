from app.db import get_session
from sqlmodel import Session
from app.models import Chats, Rubrics, Classes, Documents, Topics, Schedules, Events
from fastapi import Depends
import logging
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini, UPLOAD_FOLDER
from app.utils.chat import get_conversation_history
from sqlmodel import select
from app.models import Messages
from app.utils.rubric import get_rubric
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
import os
import PyPDF2
import docx
import io

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str, mime_type: str) -> str:
    """
    Extract text content from various file types.
    
    Args:
        file_path: Path to the file
        mime_type: MIME type of the file
        
    Returns:
        Extracted text content or empty string if extraction fails
    """
    try:
        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        
        if not os.path.exists(full_path):
            logger.warning(f"File not found: {full_path}")
            return ""
        
        # PDF files
        if mime_type == "application/pdf" or file_path.lower().endswith('.pdf'):
            try:
                with open(full_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n"
                    return text.strip()
            except Exception as e:
                logger.error(f"Error extracting PDF text from {file_path}: {str(e)}")
                return ""
        
        # Word documents
        elif mime_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                          "application/msword"] or file_path.lower().endswith(('.docx', '.doc')):
            try:
                if file_path.lower().endswith('.docx'):
                    doc = docx.Document(full_path)
                    text = ""
                    for paragraph in doc.paragraphs:
                        text += paragraph.text + "\n"
                    return text.strip()
                else:
                    # For .doc files, we'd need python-docx2txt or similar
                    logger.warning(f"Legacy .doc format not fully supported: {file_path}")
                    return ""
            except Exception as e:
                logger.error(f"Error extracting Word document text from {file_path}: {str(e)}")
                return ""
        
        # Plain text files
        elif mime_type.startswith("text/") or file_path.lower().endswith(('.txt', '.md', '.rst')):
            try:
                with open(full_path, 'r', encoding='utf-8') as file:
                    return file.read().strip()
            except UnicodeDecodeError:
                # Try with different encoding
                try:
                    with open(full_path, 'r', encoding='latin-1') as file:
                        return file.read().strip()
                except Exception as e:
                    logger.error(f"Error reading text file {file_path}: {str(e)}")
                    return ""
            except Exception as e:
                logger.error(f"Error reading text file {file_path}: {str(e)}")
                return ""
        
        else:
            logger.info(f"Unsupported file type for text extraction: {mime_type} ({file_path})")
            return ""
            
    except Exception as e:
        logger.error(f"Unexpected error extracting text from {file_path}: {str(e)}")
        return ""


async def run_course_agent(
    class_id: str, session: Session = Depends(get_session)
) -> dict:
    """
    This function is used to run the course agent.
    Returns a dictionary with course results.

    Args:
        class_id: The ID of the class

    Returns:
        A dictionary containing course results and statistics.
    """

    # get the class from the class_id
    class_data = session.exec(select(Classes).where(Classes.id == class_id)).first()
    if not class_data:
        raise ValueError(f"Class with ID {class_id} not found")

    # get all the documents for the class
    documents = session.exec(select(Documents).where(Documents.class_id == class_id)).all()
    
    if not documents:
        logger.info(f"No documents found for class {class_id}")
        return {
            "success": True,
            "message": "No documents to analyze",
            "documents_count": 0
        }

    # Format documents for the agent with their content if available
    document_info = []
    syllabus_content = ""
    
    for doc in documents:
        doc_info = f"File: {doc.name} (Type: {doc.type})"
        
        # Extract content for syllabus files
        if doc.type == 'syllabus':
            content = extract_text_from_file(doc.file_path, doc.mime_type)
            if content:
                syllabus_content += f"\n\n=== SYLLABUS CONTENT FROM {doc.name} ===\n{content}\n"
                doc_info += f" - Content extracted ({len(content)} characters)"
            else:
                doc_info += " - Content extraction failed"
        
        document_info.append(doc_info)

    # Combine document list with syllabus content
    formatted_documents = "\n".join(document_info)
    if syllabus_content:
        formatted_documents += syllabus_content
    
    logger.info(f"Analyzing {len(documents)} documents for class {class_data.name}")
    if syllabus_content:
        logger.info(f"Extracted content from {syllabus_content.count('=== SYLLABUS CONTENT FROM')} syllabus file(s)")

    course_agent = CourseAgent()
    
    try:
        result = await Runner.run(course_agent.agent(), input=formatted_documents)
        course = result.final_output_as(Course)
        
        # Log debug info if available
        if course.debug_info:
            logger.info(f"Course Agent Debug Info: {course.debug_info}")
        
        # Update the class information
        updates_made = []
        
        if course.name and course.name != class_data.name:
            class_data.name = course.name
            updates_made.append(f"name: {course.name}")
            
        if course.code and course.code != class_data.class_code:
            class_data.class_code = course.code
            updates_made.append(f"code: {course.code}")
            
        if course.desc and course.desc != class_data.description:
            class_data.description = course.desc
            updates_made.append(f"description: {course.desc}")
            
        if course.year and course.year != class_data.year:
            class_data.year = course.year
            updates_made.append(f"year: {course.year}")
            
        if course.term and course.term != class_data.term:
            class_data.term = course.term
            updates_made.append(f"term: {course.term}")

        # Handle topics - delete existing and create new ones
        if course.topics:
            # Delete existing topics
            existing_topics = session.exec(select(Topics).where(Topics.class_id == class_id)).all()
            for topic in existing_topics:
                session.delete(topic)
            
            # Create new topics
            for topic_name in course.topics:
                new_topic = Topics(
                    name=topic_name,
                    description=f"Topic extracted from course analysis",
                    prerequisite=False,
                    class_id=class_data.id
                )
                session.add(new_topic)
            updates_made.append(f"topics: {len(course.topics)} topics")

        # Handle prerequisites as topics
        if course.prereqs:
            for prereq_name in course.prereqs:
                prereq_topic = Topics(
                    name=prereq_name,
                    description=f"Prerequisite extracted from course analysis",
                    prerequisite=True,
                    class_id=class_data.id
                )
                session.add(prereq_topic)
            updates_made.append(f"prerequisites: {len(course.prereqs)} prerequisites")

        # Handle schedules
        if course.schedules:
            # Delete existing schedules and their events
            existing_schedules = session.exec(select(Schedules).where(Schedules.class_id == class_id)).all()
            for schedule in existing_schedules:
                # Delete events first
                existing_events = session.exec(select(Events).where(Events.schedule_id == schedule.id)).all()
                for event in existing_events:
                    session.delete(event)
                session.delete(schedule)
            
            # Create new schedules
            for schedule_data in course.schedules:
                new_schedule = Schedules(
                    name=schedule_data.name,
                    description=schedule_data.description,
                    class_id=class_data.id
                )
                session.add(new_schedule)
                session.flush()  # To get the schedule ID
                
                # Create events for this schedule
                for event_name in schedule_data.events:
                    new_event = Events(
                        name=event_name,
                        description=f"Event from {schedule_data.name}",
                        time=datetime.now(),  # Default time, should be updated later
                        schedule_id=new_schedule.id
                    )
                    session.add(new_event)
            
            updates_made.append(f"schedules: {len(course.schedules)} schedules")

        session.commit()
        
        logger.info(f"Successfully updated class {class_data.name}. Updates: {', '.join(updates_made) if updates_made else 'No updates needed'}")
        
        return {
            "success": True,
            "message": f"Successfully processed course information",
            "updates_made": updates_made,
            "documents_count": len(documents),
            "course_info": {
                "name": course.name,
                "code": course.code,
                "description": course.desc,
                "year": course.year,
                "term": course.term,
                "topics_count": len(course.topics) if course.topics else 0,
                "prereqs_count": len(course.prereqs) if course.prereqs else 0,
                "schedules_count": len(course.schedules) if course.schedules else 0
            },
            "debug_info": course.debug_info
        }
        
    except Exception as e:
        logger.error(f"Error during course analysis: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Course analysis failed: {str(e)}",
            "documents_count": len(documents)
        }


class Schedule(BaseModel):
    name: str
    description: str
    events: list[str]


class Course(BaseModel):
    name: str = ""
    code: str = ""
    desc: str = ""
    year: int = 0
    term: str = "fall"
    topics: list[str] = []
    prereqs: list[str] = []
    schedules: list[Schedule] = []
    debug_info: str = ""
    

class CourseAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = """Your purpose is to analyze a class based on its file names, document information, and syllabus content when available. You should try to fill in as much information as possible about the class. Here are some guidelines to help you:

        INPUT FORMAT:
        You will receive a list of documents with their names and types, followed by extracted content from any syllabus files (marked with "=== SYLLABUS CONTENT FROM filename ===").

        EXTRACTION GUIDELINES:

        NAME & CODE: Extract the course name and code from syllabus content or infer from document names. Look for patterns like "CS 101", "MATH 240", "Introduction to Computer Science", etc.

        DESCRIPTION: Use the course description from the syllabus if available, or create a brief description based on the course name and topics.

        YEAR & TERM: Look for academic year (e.g., 2024, 2023-2024) and term information in syllabus content. The term should only be one of: spring, summer, fall.

        TOPICS: Extract main subjects/topics covered in the class from:
        - Course outline/schedule in syllabus
        - Lecture titles in document names
        - Learning objectives or course content sections
        - Assignment and project names

        PREREQUISITES: Look for prerequisite courses or knowledge mentioned in the syllabus. These should be specific course codes or topic areas that students need before taking this class.

        SCHEDULES: Create structured schedules based on the information available:
        - Exam Schedule: Extract exam dates, midterms, finals
        - Assignment Schedule: Homework, projects, labs with due dates if available
        - Lecture Schedule: Weekly topics, chapter coverage
        - Assessment Schedule: Quizzes, presentations, etc.

        Each schedule should have:
        - name: descriptive name (e.g., "Exam Schedule", "Assignment Schedule")
        - description: brief explanation of what this schedule covers
        - events: list of specific event names (e.g., ["Midterm Exam", "Final Exam"])

        DEBUG INFO: Use this field to note:
        - What information was missing or unclear
        - What assumptions you made
        - Suggestions for better course analysis (e.g., "Would benefit from reading assignment descriptions", "Course calendar would help with scheduling")
        - Any issues with the provided data

        IMPORTANT: Base your analysis primarily on syllabus content when available, and use document names as supporting evidence. Be specific and accurate rather than making broad assumptions.
        
        Return a JSON object with the course information:
        {
            "name": "string",
            "code": "string", 
            "desc": "string",
            "year": "int",
            "term": "string",
            "topics": "list[str]",
            "prereqs": "list[str]",
            "schedules": "list[Schedule]",
            "debug_info": "string"
        }"""

    def agent(self):
        return Agent(
            name="Course Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
            output_type=Course,
        )
