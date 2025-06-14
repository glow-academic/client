import logging
import uuid
from typing import Any

from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, Runner
from app.db import get_session
from app.extensions import get_gemini
from app.models import Classes, Documents
from fastapi import Depends
from openai.types import Reasoning
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


async def run_classify_agent(
    class_id: uuid.UUID, session: Session = Depends(get_session)
) -> dict[str, Any]:
    """
    This function is used to run the classify agent.
    Returns a dictionary with classification results.

    Args:
        class_id: The ID of the class

    Returns:
        A dictionary containing classification results and statistics.
    """

    # get the class from the class_id
    class_data = session.exec(select(Classes).where(Classes.id == class_id)).first()
    if not class_data:
        raise ValueError(f"Class with ID {class_id} not found")

    # get all the documents for the class that haven't been classified yet
    # Note: Since there's no 'classified' field in the model, we'll classify all documents
    documents = session.exec(
        select(Documents).where(Documents.class_id == class_id)
    ).all()

    if not documents:
        logger.info(f"No documents found for class {class_id}")
        return {
            "success": True,
            "message": "No documents to classify",
            "classified_count": 0,
            "total_count": 0,
        }

    # Format documents for the agent: "1: document_name.ext\n2: document_name.ext\n..."
    document_list = []
    document_mapping = {}
    for i, doc in enumerate(documents, 1):
        document_list.append(f"{i}: {doc.name}")
        document_mapping[str(i)] = doc

    formatted_documents = "\n".join(document_list)

    logger.info(f"Classifying {len(documents)} documents for class {class_data.name}")

    classify_agent = ClassifyAgent()

    try:
        result = await Runner.run(classify_agent.agent(), input=formatted_documents)
        classification = result.final_output_as(Classify)

        # Update the type of all the mapped documents
        classified_count = 0

        # Process each category
        for category, doc_numbers in classification.model_dump().items():
            if doc_numbers:  # Only process if there are documents in this category
                for doc_num in doc_numbers:
                    if doc_num in document_mapping:
                        document = document_mapping[doc_num]
                        # Map category names to document types
                        type_mapping = {
                            "homeworks": "homework",
                            "projects": "project",
                            "quizzes": "quiz",
                            "midterms": "midterm",
                            "labs": "lab",
                            "lectures": "lecture",
                            "syllabi": "syllabus",
                        }

                        new_type = type_mapping.get(category, "homework")
                        if document.type != new_type:
                            document.type = new_type
                            session.add(document)
                            classified_count += 1
                            logger.info(
                                f"Updated document '{document.name}' to type '{new_type}'"
                            )

        session.commit()

        logger.info(
            f"Successfully classified {classified_count} documents for class {class_data.name}"
        )

        return {
            "success": True,
            "message": f"Successfully classified {classified_count} documents",
            "classified_count": classified_count,
            "total_count": len(documents),
            "classification_results": classification.model_dump(),
        }

    except Exception as e:
        logger.error(f"Error during classification: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Classification failed: {str(e)}",
            "classified_count": 0,
            "total_count": len(documents),
        }


class Classify(BaseModel):
    homeworks: list[str] = []
    projects: list[str] = []
    quizzes: list[str] = []
    midterms: list[str] = []
    labs: list[str] = []
    lectures: list[str] = []
    syllabi: list[str] = []


class ClassifyAgent:
    def __init__(self) -> None:
        self.gemini_client = get_gemini()
        self.system_prompt = """Your purpose is to classify documents given for a class. You will receive a numbered list of document names and need to categorize each document by its number.

Analyze each document name and classify it into one of these categories:
- homework: Assignments, problem sets, exercises
- project: Large assignments, final projects, group work
- quiz: Short assessments, pop quizzes
- midterm: Midterm exams, major tests
- lab: Laboratory exercises, practical work
- lecture: Lecture notes, slides, presentations
- syllabus: Course syllabus, course outline

Return a JSON object with arrays containing the document numbers (as strings) for each category:
{
  "homeworks": ["1", "3"],
  "projects": ["2"],
  "quizzes": ["4"],
  "midterms": ["5"],
  "labs": ["6"],
  "lectures": ["7"],
  "syllabi": ["8"]
}

Only include document numbers that actually exist in the input. Leave arrays empty if no documents match that category."""

    def agent(self) -> Agent:
        if self.gemini_client is None:
            raise ValueError("Gemini client is not initialized")
        
        return Agent(
            name="Classify Agent",
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
            output_type=Classify,
        )
