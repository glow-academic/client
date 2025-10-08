# utils/scenario.py

import logging
import os
import random
import re
import unicodedata
import uuid
from typing import Any, Dict, List, Optional

import pypdf  # type: ignore
from agents.items import TResponseInputItem
from app.extensions import UPLOAD_FOLDER
from app.models import (Documents, ParameterItems, Parameters, Personas,
                        Scenarios)
from rapidfuzz import fuzz  # type: ignore
from sqlmodel import Session, select


def _read_document_content_for_similarity(file_path: str) -> str:
    """Read textual content from a document under UPLOAD_FOLDER for similarity scoring.

    - PDFs: extract per-page text via pypdf
    - Text files: read with UTF-8, fallback to latin-1
    """
    full_path = os.path.join(UPLOAD_FOLDER, file_path)
    content = ""
    if file_path.lower().endswith(".pdf"):
        try:
            with open(full_path, "rb") as fh:  # noqa: PTH123
                reader = pypdf.PdfReader(fh)
                for page in reader.pages:
                    content += (page.extract_text() or "") + "\n"
        except Exception:
            return ""
    else:
        try:
            with open(full_path, "r", encoding="utf-8") as fh:  # noqa: PTH123
                content = fh.read()
        except UnicodeDecodeError:
            try:
                with open(full_path, "r", encoding="latin-1") as fh:  # noqa: PTH123
                    content = fh.read()
            except Exception:
                return ""
        except Exception:
            return ""

    return content.strip()

logger = logging.getLogger(__name__)

def get_parameter_item_info(
    parameter_item_ids: List[uuid.UUID], session: Session
) -> TResponseInputItem:
    """
    Get the parameter item information for a given parameter item ids, including their value.
    """
    # Join ParameterItems with Parameters to get parameter name and description
    parameter_items_with_params = session.exec(
        select(ParameterItems, Parameters)
        .join(Parameters, ParameterItems.parameter_id == Parameters.id)
        .where(ParameterItems.id.in_(parameter_item_ids))
    ).all()

    if not parameter_items_with_params:
        return {
            "role": "user",
            "content": "No parameter items found.",
        }

    # Format each parameter item using the template, including .value
    formatted_items = []
    for param_item, param in parameter_items_with_params:
        formatted_item = (
            f"This is the {param.name} ({param.description}) for this chat: {param_item.name}. "
            f"Description: {param_item.description}."
        )
        formatted_items.append(formatted_item)

    content = "The following is the parameter item information:\n" + "\n".join(
        formatted_items
    )

    return {
        "role": "user",
        "content": content,
    }


async def randomly_fill_scenario_attributes(
    scenario: Scenarios, session: Session, department_id: uuid.UUID
) -> Scenarios:
    """
    Randomly fill null attributes of a scenario with available options from the database.

    Args:
        scenario: The scenario object with potentially null attributes
        session: Database session
        department_id: The department ID to use when creating a new scenario

    Returns:
        Updated scenario object with randomly selected values for null attributes
    """



    # Random agent selection if agent_id is null
    if scenario.persona_id is None:
        # Only select from active personas
        active_personas = session.exec(select(Personas).where(Personas.active)).all()
        if active_personas:
            scenario_persona_id = random.choice(active_personas).id
            logger.info(f"Randomly selected persona_id: {scenario_persona_id}")
        else:
            scenario_persona_id = None
            logger.info("No active personas found")
    else:
        scenario_persona_id = scenario.persona_id

    # Document selection if documents is null
    if scenario.document_ids is None:
        # Only select from active documents
        active_documents = session.exec(select(Documents).where(Documents.active)).all()

        def _norm(s: str) -> str:
            s_norm = unicodedata.normalize("NFKD", s or "")
            s_norm = "".join(ch for ch in s_norm if not unicodedata.combining(ch))
            return re.sub(r"\s+", " ", s_norm.strip().lower())

        def _tokens(s: str) -> list[str]:
            return [t for t in _norm(s).split(" ") if t]

        if active_documents:
            # Build scenario signal text from name/description
            scenario_text = f"{scenario.name or ''} {scenario.description or ''}"
            scenario_tokens = set(_tokens(scenario_text))

            known_types = [
                "homework",
                "project",
                "quiz",
                "midterm",
                "lab",
                "lecture",
                "syllabus",
            ]
            scenario_has_type = {t: (t in scenario_tokens) or (t in _norm(scenario_text)) for t in known_types}

            def _score(doc: Documents) -> float:
                score = 0.0
                tag_tokens: set[str] = set()
                for tag in (doc.tags or []):
                    tag_tokens.update(_tokens(tag))
                overlap = scenario_tokens.intersection(tag_tokens)
                score += 5.0 * len(overlap)
                name_tokens = set(_tokens(doc.name or ""))
                score += 2.0 * len(scenario_tokens.intersection(name_tokens))
                doc_type = (doc.type or "").lower()
                if doc_type and (scenario_has_type.get(doc_type, False)):
                    score += 10.0
                if doc_type and doc_type in _norm(scenario_text):
                    score += 3.0
                # add jitter to reduce determinism
                score += random.random() * 0.25
                return score

            # Build clusters per tag and choose one tag to ensure all selected share the same tag
            tag_to_docs: dict[str, list[Documents]] = {}
            for d in active_documents:
                tags = d.tags or ["__untagged__"]
                if len(tags) == 0:
                    tags = ["__untagged__"]
                for t in tags:
                    tag_to_docs.setdefault(t, []).append(d)

            # Score each tag by the best document score in that cluster
            tag_scores: list[tuple[str, float]] = []
            for t, docs in tag_to_docs.items():
                best = 0.0
                for d in docs:
                    s = _score(d)
                    if s > best:
                        best = s
                # jitter per tag to avoid ties
                tag_scores.append((t, best + random.random() * 0.1))

            tag_scores.sort(key=lambda x: x[1], reverse=True)
            chosen_tag = tag_scores[0][0] if tag_scores else "__untagged__"
            candidates = tag_to_docs.get(chosen_tag, [])
            # Sort candidates by score and take 1, but sample randomly among top N
            cand_scored = [(d, _score(d)) for d in candidates]
            cand_scored.sort(key=lambda x: x[1], reverse=True)
            top_n = cand_scored[: min(6, len(cand_scored))]
            k = min(1, len(top_n))
            selected_docs = [d for d, _ in random.sample(top_n, k)] if k > 0 else []
            logger.info(
                f"Selected document with shared tag '{chosen_tag}' (count={len(selected_docs)}): {[d.id for d in selected_docs]}"
            )

            scenario_documents = [doc.id for doc in selected_docs]
        else:
            scenario_documents = []
            logger.info("No active documents found")
    else:
        scenario_documents = scenario.document_ids

    # Random parameter item selection if parameter_item_ids is null or empty
    if scenario.parameter_item_ids is None or len(scenario.parameter_item_ids) == 0:
        # Get all active parameters
        active_parameters = session.exec(
            select(Parameters).where(Parameters.active)
        ).all()

        if active_parameters:
            # For each active parameter, randomly select one parameter item
            scenario_parameter_item_ids = []
            for param in active_parameters:
                # Get all parameter items for this parameter
                param_items = session.exec(
                    select(ParameterItems).where(
                        ParameterItems.parameter_id == param.id
                    )
                ).all()

                if param_items:
                    # Randomly select one parameter item from this parameter
                    selected_item = random.choice(param_items)
                    scenario_parameter_item_ids.append(selected_item.id)
                    logger.info(
                        f"Selected parameter item for {param.name}: {selected_item.name}"
                    )

            logger.info(
                f"Randomly selected {len(scenario_parameter_item_ids)} parameter items (one per active parameter): {scenario_parameter_item_ids}"
            )
        else:
            scenario_parameter_item_ids = []
            logger.info("No active parameters found")
    else:
        # If parameter_item_ids are provided, ensure we have one per active parameter
        # Get all active parameters
        active_parameters = session.exec(
            select(Parameters).where(Parameters.active)
        ).all()
        active_param_ids = {param.id for param in active_parameters}

        # Get all parameter items for the provided IDs
        existing_param_items = session.exec(
            select(ParameterItems).where(
                ParameterItems.id.in_(scenario.parameter_item_ids)
            )
        ).all()

        # Group existing parameter items by their parameter_id
        existing_items_by_param: dict[uuid.UUID, list[ParameterItems]] = {}
        for item in existing_param_items:
            if item.parameter_id not in existing_items_by_param:
                existing_items_by_param[item.parameter_id] = []
            existing_items_by_param[item.parameter_id].append(item)

        # For each active parameter, ensure we have exactly one parameter item
        scenario_parameter_item_ids = []
        for param_id in active_param_ids:
            if param_id in existing_items_by_param:
                items = existing_items_by_param[param_id]
                if len(items) > 1:
                    # Multiple items for this parameter, randomly select one
                    selected_item = random.choice(items)
                    scenario_parameter_item_ids.append(selected_item.id)
                else:
                    # Only one item for this parameter
                    scenario_parameter_item_ids.append(items[0].id)
            else:
                # No items for this parameter, randomly select one
                param_items = session.exec(
                    select(ParameterItems).where(
                        ParameterItems.parameter_id == param_id
                    )
                ).all()
                if param_items:
                    selected_item = random.choice(param_items)
                    scenario_parameter_item_ids.append(selected_item.id)
                    logger.info(f"Filled missing parameter item for parameter {param_id}: {selected_item.name}")
                else:
                    logger.warning(f"No parameter items found for parameter {param_id}")

    # Check if we actually need to create a new scenario
    # If all the values are the same as the original scenario, return the original
    # Sort lists for comparison to handle order differences
    original_docs = sorted(scenario.document_ids or [])
    new_docs = sorted(scenario_documents or [])
    original_params = sorted(scenario.parameter_item_ids or [])
    new_params = sorted(scenario_parameter_item_ids or [])
    
    if (scenario_persona_id == scenario.persona_id and 
        new_docs == original_docs and 
        new_params == original_params):
        return scenario
    
    # Create a new scenario only if we actually have changes
    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        persona_id=scenario_persona_id,
        document_ids=scenario_documents,
        parameter_item_ids=scenario_parameter_item_ids,
        department_id=department_id,
        generated=True,
        parent_id=scenario.id,  # since we are creating a new scenario, we need to set the parent_id to the original scenario
    )


# -------------------------- Suggestion Utilities ---------------------------
def _norm(text: str | None) -> str:
    text = text or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.strip().lower())


def _tokens(text: str | None) -> list[str]:
    return [t for t in _norm(text).split(" ") if t]


def _weighted_choice(weighted_items: list[tuple[Any, float]]) -> Any | None:
    """Return one item chosen with probability proportional to its weight.
    Returns None when all weights are non-positive or list is empty.
    """
    if not weighted_items:
        return None
    # Ensure non-negative weights
    weights = [max(0.0, float(w)) for _, w in weighted_items]
    total = sum(weights)
    if total <= 0.0:
        return None
    r = random.random() * total
    cumsum = 0.0
    for item, w in weighted_items:
        cumsum += max(0.0, float(w))
        if r <= cumsum:
            return item
    return weighted_items[-1][0]


def _weighted_sample_without_replacement(items: list[Any], scores: list[float], k: int) -> list[Any]:
    """Sample up to k unique items proportionally to scores without replacement.
    Falls back to fewer items if necessary.
    """
    selected: list[Any] = []
    pool_items = list(items)
    pool_scores = [max(0.0, float(s)) for s in scores]
    for _ in range(min(k, len(pool_items))):
        total = sum(pool_scores)
        if total <= 0.0:
            # pick uniformly at random from remaining
            choice_idx = random.randrange(len(pool_items))
        else:
            r = random.random() * total
            cumsum = 0.0
            choice_idx = 0
            for i, s in enumerate(pool_scores):
                cumsum += s
                if r <= cumsum:
                    choice_idx = i
                    break
        selected.append(pool_items.pop(choice_idx))
        pool_scores.pop(choice_idx)
    return selected


def suggest_randomized_sections(
    *,
    name: Optional[str],
    description: Optional[str],
    persona_id: Optional[uuid.UUID],
    document_ids: Optional[List[uuid.UUID]],
    parameter_item_ids: Optional[List[uuid.UUID]],
    targets: List[str],
    session: Session,
) -> Dict[str, Any]:
    """Suggest persona/documents/parameters based on current inputs and text.

    - If a section isn't listed in targets, it is returned unchanged.
    - If listed, it is suggested using similarity heuristics against scenario text,
      selected persona, and selected documents.
    """
    targets_set = {t.lower() for t in (targets or [])}

    base_text = f"{name or ''} {description or ''}"
    context_tokens: set[str] = set(_tokens(base_text))
    # Keep a raw context string for fuzzy similarity (in addition to tokens)
    context_text = _norm(base_text)

    # Load current persona/documents if provided to enrich context
    current_persona: Personas | None = None
    if persona_id:
        current_persona = session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
        if current_persona:
            context_tokens.update(_tokens(current_persona.name))
            context_tokens.update(_tokens(current_persona.description))
            context_text = f"{context_text} {_norm(current_persona.name)} {_norm(current_persona.description)}"

    current_documents: list[Documents] = []
    if document_ids:
        current_documents = list(
            session.exec(
                select(Documents).where(Documents.id.in_(document_ids))
            ).all()
        )
        for d in current_documents:
            context_tokens.update(_tokens(d.name))
            for tag in (d.tags or []):
                context_tokens.update(_tokens(tag))
            context_tokens.add(_norm(d.type))
            # Include current document content to help parameter/persona choice
            try:
                doc_text = _read_document_content_for_similarity(d.file_path)
                # Limit size for performance
                doc_text = doc_text[:5000]
                context_text = f"{context_text} {_norm(doc_text)}"
            except Exception:
                pass

    # Suggest persona -----------------------------------------------------
    suggested_persona_id = persona_id
    if "persona" in targets_set:
        # Make persona selection fully random among active personas to reduce determinism
        active_personas = session.exec(select(Personas).where(Personas.active)).all()
        if active_personas:
            suggested_persona_id = random.choice(active_personas).id

    # Suggest documents ---------------------------------------------------
    # If documents explicitly provided as empty list, respect "no documents"
    if document_ids is not None and len(document_ids) == 0:
        suggested_document_ids = []
    else:
        suggested_document_ids = list(document_ids or [])
    if "documents" in targets_set:
        # Respect explicit no-documents signal
        if document_ids is not None and len(document_ids) == 0:
            suggested_document_ids = []
            return {
                "persona_id": persona_id,
                "document_ids": suggested_document_ids,
                "parameter_item_ids": list(parameter_item_ids or []),
            }
        active_documents = session.exec(select(Documents).where(Documents.active)).all()
        known_types = [
            "homework",
            "project",
            "quiz",
            "midterm",
            "lab",
            "lecture",
            "syllabus",
        ]
        scenario_text_norm = _norm(base_text)
        has_type = {t: (t in context_tokens) or (t in scenario_text_norm) for t in known_types}

        def score_doc(doc: Documents) -> float:
            score = 0.0
            tag_tokens: set[str] = set()
            for tag in (doc.tags or []):
                tag_tokens.update(_tokens(tag))
            overlap = context_tokens.intersection(tag_tokens)
            score += 5.0 * len(overlap)
            name_overlap = context_tokens.intersection(set(_tokens(doc.name or "")))
            score += 2.0 * len(name_overlap)
            d_type = (doc.type or "").lower()
            if d_type and has_type.get(d_type, False):
                score += 10.0
            if d_type and d_type in scenario_text_norm:
                score += 3.0
            # Content similarity (token set ratio over truncated content)
            try:
                doc_text = _read_document_content_for_similarity(doc.file_path)
                doc_text = doc_text[:5000]
                sim = fuzz.token_set_ratio(context_text, _norm(doc_text))  # 0..100
                score += sim * 0.15  # weight content moderately
            except Exception:
                pass
            return score

        if active_documents:
            # Ensure all selected share the same tag
            tag_to_docs: dict[str, list[Documents]] = {}
            for d in active_documents:
                tags = d.tags or ["__untagged__"]
                if len(tags) == 0:
                    tags = ["__untagged__"]
                for t in tags:
                    tag_to_docs.setdefault(t, []).append(d)

            # Rank tags by best doc score with jitter
            tag_scores: list[tuple[str, float]] = []
            for t, docs in tag_to_docs.items():
                best = 0.0
                for d in docs:
                    s = score_doc(d)
                    if s > best:
                        best = s
                tag_scores.append((t, best + random.random() * 0.1))
            # Pick a tag by weighted probability (less deterministic)
            chosen_tag = _weighted_choice(tag_scores) or (tag_scores[0][0] if tag_scores else "__untagged__")
            candidates = tag_to_docs.get(chosen_tag, [])
            # Score candidates and sample 1 without replacement by weight
            cand_docs = candidates
            cand_scores = [score_doc(d) for d in cand_docs]
            selected = _weighted_sample_without_replacement(cand_docs, cand_scores, 1)
            suggested_document_ids = [d.id for d in selected]

    # Suggest parameters --------------------------------------------------
    suggested_parameter_item_ids = list(parameter_item_ids or [])
    if "parameters" in targets_set:
        active_parameters = session.exec(select(Parameters).where(Parameters.active)).all()
        if active_parameters:
            chosen: list[uuid.UUID] = []
            for param in active_parameters:
                items = session.exec(select(ParameterItems).where(ParameterItems.parameter_id == param.id)).all()
                if not items:
                    continue
                # If parameter.default_parameter is True => completely random item
                param_is_default = getattr(param, "default_parameter", False)
                if param_is_default:
                    chosen.append(random.choice(items).id)
                else:
                    # non-default: similarity-based with randomness
                    def score_item(it: ParameterItems) -> float:
                        score = 0.0
                        name_norm = _norm(it.name)
                        desc_norm = _norm(it.description)
                        value_norm = _norm(it.value)

                        # Token overlaps
                        name_tokens = set(_tokens(name_norm))
                        desc_tokens = set(_tokens(desc_norm))
                        value_tokens = set(_tokens(value_norm))
                        p_tokens = set(_tokens(param.name)) | set(_tokens(param.description))

                        # Item tokens overlap with context (value gets higher weight)
                        score += 2.0 * len(name_tokens & context_tokens)
                        score += 2.0 * len(desc_tokens & context_tokens)
                        score += 6.0 * len(value_tokens & context_tokens)

                        # Parameter name/desc overlap with context
                        score += 1.5 * len(p_tokens & context_tokens)

                        # Exact phrase boost for value if appears in context
                        if value_norm and value_norm in context_text:
                            score += 25.0

                        # Fuzzy similarity with heavier emphasis on value
                        sim_all: float = float(
                            fuzz.token_set_ratio(
                                context_text, _norm(f"{it.name} {it.description} {it.value}")
                            )
                        )
                        sim_value: float = float(fuzz.token_set_ratio(context_text, value_norm))
                        score += sim_all * 0.06
                        score += sim_value * 0.20

                        # Small randomness to avoid determinism
                        score += random.random() * 0.75
                        return score

                    ranked_items = sorted(items, key=score_item, reverse=True)
                    top_pool = ranked_items[: min(5, len(ranked_items))]
                    if top_pool:
                        chosen_item = random.choice(top_pool)
                        chosen.append(chosen_item.id)
            suggested_parameter_item_ids = chosen

    return {
        "persona_id": suggested_persona_id,
        "document_ids": suggested_document_ids,
        "parameter_item_ids": suggested_parameter_item_ids,
    }
