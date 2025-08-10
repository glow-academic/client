import logging
import uuid
from typing import Any

from agents import Runner, trace
from app.db import get_session
from app.models import (Agents, DebugInfo, Documents, ModelRuns, Models,
                        Providers)
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class Classify(BaseModel):
    homeworks: list[str] = []
    projects: list[str] = []
    quizzes: list[str] = []
    midterms: list[str] = []
    labs: list[str] = []
    lectures: list[str] = []
    syllabi: list[str] = []
    debug_info: str | None = None


async def run_classify_agent(
    document_ids: list[uuid.UUID],
    test: bool = False,
    session: Session = Depends(get_session),
    profile_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """
    This function is used to run the classify agent.
    Returns a dictionary with classification results.

    Args:
        document_ids: The IDs of the documents to classify
        test: Whether to run the agent in test mode

    Returns:
        A dictionary containing classification results and statistics.
    """

    # find agent with name of "Classify"
    agent = session.exec(select(Agents).where(Agents.name == "Classify")).one()
    if not agent:
        raise ValueError("Classify agent not found")

    # get all the documents for the class that haven't been classified yet
    # Note: Since there's no 'classified' field in the model, we'll classify all documents
    documents = session.exec(
        select(Documents).where(Documents.id.in_(document_ids))
    ).all()

    if not documents:
        logger.info(f"No documents found for document_ids {document_ids}")
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

    logger.info(
        f"Classifying {len(documents)} documents for document_ids {document_ids}"
    )

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")

    # getting the provider from the model's provider_id
    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    classify_agent = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        api_key=provider.api_key,
        reasoning=agent.reasoning,
        output_type=Classify,
    )

    try:
        with trace(f"Classification for {len(document_ids)} documents"):
            if test:
                # mark all documents as homeworks
                classification = Classify(
                    homeworks=[str(i) for i in range(1, len(documents) + 1)],
                    projects=[],
                    quizzes=[],
                    midterms=[],
                    labs=[],
                    lectures=[],
                    syllabi=[],
                )
            else:

                # create model run
                model_run = ModelRuns(
                    model_id=model.id,
                    input_tokens=0,
                    output_tokens=0,
                    profile_id=profile_id,
                    agent_id=agent.id,
                )
                session.add(model_run)
                session.commit()


                result = await Runner.run(
                    classify_agent.agent(), input=formatted_documents, context=DebugContext(session=session, model_run_id=model_run.id)
                )

                usage = result.context_wrapper.usage

                model_run.input_tokens = usage.input_tokens
                model_run.output_tokens = usage.output_tokens
                session.commit()

                classification = result.final_output_as(Classify)

                # Store debug info if present
                if getattr(classification, "debug_info", None):
                    debug = DebugInfo(
                        model_run_id=model_run.id,
                        content=classification.debug_info or "",
                    )
                    session.add(debug)
                    session.commit()

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
            f"Successfully classified {classified_count} documents for document_ids {document_ids}"
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
