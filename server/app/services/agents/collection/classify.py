import logging
import uuid
from typing import Any

from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.db import get_session
from app.models import Agents, Documents, ModelRuns, Models, Providers
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for classification results
classification_results: dict[str, list[str]] = {}
classification_progress: dict[str, bool] = {}

# Default all categories to empty lists
DEFAULT_CATEGORIES = ["homeworks", "projects", "quizzes", "midterms", "labs", "lectures", "syllabi"]


def create_classification_function(category: str, category_description: str) -> Any:
    """Create a function tool for classifying documents into a specific category."""
    
    async def classify_as_category(
        document_numbers: list[str] = Field(
            description=f"List of document numbers (as strings) that should be classified as {category}. {category_description}"
        )
    ) -> str:
        f"""Classify documents as {category}.
        
        Use this tool to mark documents that belong to the {category} category.
        {category_description}
        
        Args:
            document_numbers: List of document numbers (e.g., ["1", "3", "5"]) that are {category}
            
        Returns:
            Confirmation message
        """
        # Store the document numbers for this category
        classification_results[category] = document_numbers
        classification_progress[category] = True
        
        logger.info(f"✓ Classified {len(document_numbers)} documents as {category}: {document_numbers}")
        return f"Classified {len(document_numbers)} documents as {category}"
    
    classify_as_category.__name__ = f"classify_{category}"
    return function_tool(classify_as_category)


def create_classification_tools() -> list[Any]:
    """Create all document classification function tools."""
    tools = []
    
    # Define categories with descriptions
    categories = {
        "homeworks": "Assignments, problem sets, exercises",
        "projects": "Large assignments, final projects, group work",
        "quizzes": "Short assessments, pop quizzes",
        "midterms": "Midterm exams, major tests",
        "labs": "Laboratory exercises, practical work",
        "lectures": "Lecture notes, slides, presentations",
        "syllabi": "Course syllabus, course outline",
    }
    
    for category, description in categories.items():
        tool = create_classification_function(category, description)
        tools.append(tool)
        logger.info(f"Created classification tool for: {category}")
    
    logger.info(f"Total classification tools created: {len(tools)}")
    return tools


async def run_classify_agent(
    document_ids: list[uuid.UUID],
    department_id: uuid.UUID,
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
    
    # Clear previous results and initialize all categories to empty
    global classification_results, classification_progress
    classification_results.clear()
    classification_progress.clear()

    # Initialize all categories to empty lists (default behavior)
    for category in DEFAULT_CATEGORIES:
        classification_results[category] = []

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

    # Create classification tools
    classification_tools = create_classification_tools()
    # Add debug_info tool from utils
    classification_tools.append(debug_info_tool)
    logger.info(f"Created {len(classification_tools)} classification tools (including debug_info)")

    # Create tool use behavior - OPTIONAL, agent can choose not to call all tools
    # If a category tool is not called, it defaults to empty list
    def tool_use_behavior(
        context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # No required tools - agent can skip categories that don't apply
        # Let the agent call tools freely and complete naturally
        # Always return False to let agent continue until it naturally stops
        return ToolsToFinalOutputResult(is_final_output=False)

    classify_agent = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        api_key=provider.api_key,
        reasoning=agent.reasoning,
        tools=classification_tools,
        parallel_tool_calls=True,
        tool_use_behavior=tool_use_behavior,
        custom_model=model.custom_model,
    )

    try:
        with trace(f"Classification for {len(document_ids)} documents"):
            if test:
                # mark all documents as homeworks
                classification_dict = {
                    "homeworks": [str(i) for i in range(1, len(documents) + 1)],
                    "projects": [],
                    "quizzes": [],
                    "midterms": [],
                    "labs": [],
                    "lectures": [],
                    "syllabi": [],
                }
            else:

                default_guest_profile = find_default_guest_profile(session)

                final_profile_id = (profile_id if profile_id else (default_guest_profile.id if default_guest_profile else None))

                success, error_message = check_rate_limit(final_profile_id, session)
                if not success:
                    raise ValueError(error_message)
                
                # create model run
                model_run = ModelRuns(
                    model_id=model.id,
                    input_tokens=0,
                    output_tokens=0,
                    profile_id=final_profile_id,
                    agent_id=agent.id,
                    department_id=department_id,
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

                # Extract results from the global storage
                # Categories not called by agent remain as empty lists (lazy default)
                classification_dict = classification_results.copy()

                # Debug info is automatically handled by debug_info_tool via DebugContext
                # No need for manual debug info storage

                logger.info("Classification completed successfully")
                logger.info(f"Classification results: {classification_dict}")

        # Update the type of all the mapped documents
        classified_count = 0

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

        # Process each category from tool call results
        for category, doc_numbers in classification_dict.items():
            # Skip debug_info if it appears in results
            if category == "debug_info":
                continue
                
            if doc_numbers:  # Only process if there are documents in this category
                for doc_num in doc_numbers:
                    if doc_num in document_mapping:
                        document = document_mapping[doc_num]
                        new_type = type_mapping.get(category, "homework")
                        if document.type != new_type:
                            document.type = new_type
                            session.add(document)
                            classified_count += 1
                            logger.info(
                                f"Updated document '{document.name}' to type '{new_type}'"
                            )

        # Lazy behavior: Any documents not classified by any tool default to "homework"
        classified_doc_nums = set()
        for doc_numbers in classification_dict.values():
            if isinstance(doc_numbers, list):
                classified_doc_nums.update(doc_numbers)

        # Find documents that weren't classified by any tool
        all_doc_nums = set(document_mapping.keys())
        unclassified_doc_nums = all_doc_nums - classified_doc_nums

        if unclassified_doc_nums:
            logger.info(f"Defaulting {len(unclassified_doc_nums)} unclassified documents to 'homework'")
            for doc_num in unclassified_doc_nums:
                if doc_num in document_mapping:
                    document = document_mapping[doc_num]
                    if document.type != "homework":
                        document.type = "homework"
                        session.add(document)
                        classified_count += 1
                        logger.info(f"Defaulted document '{document.name}' to type 'homework'")
            
            # Add to classification results for completeness
            classification_dict.setdefault("homeworks", []).extend(list(unclassified_doc_nums))

        session.commit()

        logger.info(
            f"Successfully classified {classified_count} documents for document_ids {document_ids}"
        )

        return {
            "success": True,
            "message": f"Successfully classified {classified_count} documents",
            "classified_count": classified_count,
            "total_count": len(documents),
            "classification_results": classification_dict,
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
