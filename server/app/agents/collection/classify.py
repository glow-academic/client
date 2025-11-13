import logging
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.sql_helper import load_sql
from fastapi import Depends
from pydantic import Field

logger = logging.getLogger(__name__)

# Global storage for classification results
classification_results: dict[str, list[str]] = {}
classification_progress: dict[str, bool] = {}

# Default all categories to empty lists
DEFAULT_CATEGORIES = [
    "homeworks",
    "projects",
    "quizzes",
    "midterms",
    "labs",
    "lectures",
    "syllabi",
]


def create_classification_function(category: str, category_description: str) -> Any:
    """Create a function tool for classifying documents into a specific category."""

    async def classify_as_category(
        document_numbers: list[str] = Field(
            description=f"List of document numbers (as strings) that should be classified as {category}. {category_description}"
        ),
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

        logger.info(
            f"✓ Classified {len(document_numbers)} documents as {category}: {document_numbers}"
        )
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
    conn: asyncpg.Connection = Depends(get_db),
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

    # Resolve guest profile if needed
    if not profile_id:
        sql_guest = load_sql("sql/v3/profile/get_default_guest_profile.sql")
        guest_row = await conn.fetchrow(sql_guest)
        if guest_row:
            profile_id = uuid.UUID(guest_row["id"])

    # Clear previous results and initialize all categories to empty
    global classification_results, classification_progress
    classification_results.clear()
    classification_progress.clear()

    # Initialize all categories to empty lists (default behavior)
    for category in DEFAULT_CATEGORIES:
        classification_results[category] = []

    # Get all agent/model/provider/documents data in single query using SQL file
    doc_ids = [str(d) for d in document_ids]
    sql = load_sql("sql/v3/agents/get_classification_run_context.sql")
    context_row = await conn.fetchrow(sql, doc_ids, str(department_id))
    
    if not context_row:
        raise ValueError(f"No classification agent configured for department {department_id}")
    
    # Parse JSON array for documents
    import json
    documents = (
        json.loads(context_row["documents"])
        if isinstance(context_row["documents"], str)
        else context_row["documents"]
    )
    
    context = {
        "agent_id": context_row["agent_id"],
        "name": context_row["agent_name"],
        "system_prompt": context_row["system_prompt"],
        "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
        "reasoning": context_row["reasoning"],
        "model_id": context_row["model_id"],
        "model_name": context_row["model_name"],
        "custom_model": context_row["custom_model"],
        "provider_name": context_row["provider_name"],
        "base_url": context_row["base_url"],
        "api_key": context_row["api_key"],
        "documents": documents,
    }

    documents = context["documents"]
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
        document_list.append(f"{i}: {doc['name']}")
        document_mapping[str(i)] = doc

    formatted_documents = "\n".join(document_list)

    logger.info(
        f"Classifying {len(documents)} documents for department {department_id}"
    )

    # Create classification tools
    classification_tools = create_classification_tools()
    # Add debug_info tool from utils
    classification_tools.append(debug_info_tool)
    logger.info(
        f"Created {len(classification_tools)} classification tools (including debug_info)"
    )

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
        agent_name=context["name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        tools=classification_tools,
        parallel_tool_calls=True,
        tool_use_behavior=tool_use_behavior,
        custom_model=context["custom_model"],
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
                # Check rate limit using SQL file
                from datetime import UTC, datetime
                profile_id_uuid = profile_id if profile_id else None
                if not profile_id_uuid:
                    raise ValueError("Profile not found. Please contact support.")
                
                # Calculate the start of the current day in UTC
                now_utc = datetime.now(UTC)
                start_of_day_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
                
                sql_rate_limit = load_sql("sql/v3/model_runs/check_rate_limit.sql")
                rate_limit_row = await conn.fetchrow(
                    sql_rate_limit, str(profile_id), start_of_day_utc.isoformat()
                )
                
                if not rate_limit_row:
                    raise ValueError("Profile not found.")
                
                req_per_day = rate_limit_row["req_per_day"]
                runs_today_count = rate_limit_row["runs_today_count"]
                
                if req_per_day is not None and runs_today_count >= req_per_day:
                    # Rate limit exceeded - format error message
                    from datetime import timedelta
                    from zoneinfo import ZoneInfo
                    earliest_run_created_at = rate_limit_row["earliest_run_created_at"]
                    if earliest_run_created_at:
                        next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                        eastern_tz = ZoneInfo("America/New_York")
                        next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                        error_message = (
                            f"Daily request limit of {req_per_day} reached. "
                            f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                            f"{next_allowed_et.strftime('%B %d, %Y')}."
                        )
                    else:
                        error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                    raise ValueError(error_message)

                # Create model run with all junction records using SQL file
                sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
                model_run_row = await conn.fetchrow(
                    sql_create_run,
                    str(department_id),
                    context["model_id"],
                    context["agent_id"],
                    "agent",
                    str(profile_id),
                )
                model_run_id = uuid.UUID(model_run_row["model_run_id"])

                result = await Runner.run(
                    classify_agent.agent(),
                    input=formatted_documents,
                    context=DebugContext(conn=conn, model_run_id=model_run_id),
                )

                usage = result.context_wrapper.usage

                # Update model run tokens using SQL file
                sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
                await conn.execute(
                    sql_update_tokens,
                    str(model_run_id),
                    usage.input_tokens,
                    usage.output_tokens,
                )

                # Extract results from the global storage
                # Categories not called by agent remain as empty lists (lazy default)
                classification_dict = classification_results.copy()

                # Debug info is automatically handled by debug_info_tool via DebugContext
                # No need for manual debug info storage

                logger.info("Classification completed successfully")
                logger.info(f"Classification results: {classification_dict}")

        # Build batch updates
        document_updates: dict[uuid.UUID, str] = {}

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
                        if document["type"] != new_type:
                            document_updates[uuid.UUID(document["id"])] = new_type
                            logger.info(
                                f"Queued update for document '{document['name']}' to type '{new_type}'"
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
            logger.info(
                f"Defaulting {len(unclassified_doc_nums)} unclassified documents to 'homework'"
            )
            for doc_num in unclassified_doc_nums:
                if doc_num in document_mapping:
                    document = document_mapping[doc_num]
                    if document["type"] != "homework":
                        document_updates[uuid.UUID(document["id"])] = "homework"
                        logger.info(
                            f"Queued default for document '{document['name']}' to type 'homework'"
                        )

            # Add to classification results for completeness
            classification_dict.setdefault("homeworks", []).extend(
                list(unclassified_doc_nums)
            )

        # Batch update all documents using SQL
        if document_updates:
            doc_ids = [str(d) for d in document_updates.keys()]
            types = list(document_updates.values())
            # Use UNNEST to update multiple documents with different types
            sql_batch_update = """
                UPDATE documents
                SET type = data.type, updated_at = NOW()
                FROM (
                    SELECT UNNEST($1::uuid[]) as id, UNNEST($2::text[]) as type
                ) as data
                WHERE documents.id = data.id
            """
            result_str: str = await conn.execute(sql_batch_update, doc_ids, types)
            # Parse result like "UPDATE 15" to get count
            classified_count = int(result_str.split()[-1]) if result_str else 0
            logger.info(f"Batch updated {classified_count} documents")
        else:
            classified_count = 0
            logger.info("No documents to update")

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
        return {
            "success": False,
            "message": f"Classification failed: {str(e)}",
            "classified_count": 0,
            "total_count": len(documents),
        }
