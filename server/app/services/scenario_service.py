"""Scenario service layer - business logic for scenario operations."""

from typing import Any, Dict, List

from app.queries.scenario_queries import ScenarioQueries
from app.schemas.scenarios import (CreateScenarioRequest,
                                   CreateScenarioResponse,
                                   DeleteScenarioRequest,
                                   DeleteScenarioResponse,
                                   DuplicateScenarioRequest,
                                   DuplicateScenarioResponse, ParameterDetail,
                                   ScenarioDetailDefaultRequest,
                                   ScenarioDetailRequest,
                                   ScenarioDetailResponse, ScenarioItem,
                                   ScenariosFilters, ScenariosListResponse,
                                   UpdateScenarioRequest,
                                   UpdateScenarioResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class ScenarioService:
    """Service layer for scenario operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = ScenarioQueries()

    def get_scenarios_list(
        self, filters: ScenariosFilters
    ) -> ScenariosListResponse:
        """Get scenarios list with all relationships using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_scenarios(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Build response
        scenarios = []
        objective_mapping = {}
        parameter_item_mapping = {}
        cohort_mapping = {}
        persona_mapping = {}

        for row in result:
            objective_ids = row.objective_ids or []
            parameter_item_ids = [str(pid) for pid in (row.parameter_item_ids or [])]
            simulation_ids = [str(sid) for sid in (row.simulation_ids or [])]
            cohort_ids = [str(cid) for cid in (row.cohort_ids or [])]

            scenarios.append(
                ScenarioItem(
                    scenario_id=str(row.scenario_id),
                    title=row.title,
                    problem_statement=row.problem_statement,
                    objective_ids=objective_ids,
                    persona_id=str(row.persona_id) if row.persona_id else None,
                    parameter_item_ids=parameter_item_ids,
                    simulation_ids=simulation_ids,
                    num_simulations=row.num_simulations,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    can_duplicate=row.can_duplicate,
                    cohort_ids=cohort_ids,
                )
            )

        # Get objective names for mapping
        if objective_ids_to_fetch := list(
            set([oid for s in scenarios for oid in s.objective_ids])
        ):
            # Parse composite keys
            obj_parts = [oid.split("_") for oid in objective_ids_to_fetch]
            scenario_idx_pairs = [
                (parts[0], int(parts[1])) for parts in obj_parts if len(parts) == 2
            ]

            if scenario_idx_pairs:
                scenario_ids = [pair[0] for pair in scenario_idx_pairs]
                idxs = [pair[1] for pair in scenario_idx_pairs]

                query, params = self.queries.get_objective_mapping(scenario_ids, idxs)
                obj_result = self.db.execute(text(query), params).fetchall()

                for row in obj_result:
                    objective_mapping[row.objective_id] = row.objective

        # Get parameter_item names for mapping
        if parameter_item_ids_to_fetch := list(
            set([pid for s in scenarios for pid in s.parameter_item_ids])
        ):
            query, params = self.queries.get_parameter_item_mapping(
                parameter_item_ids_to_fetch
            )
            param_item_result = self.db.execute(text(query), params).fetchall()

            for row in param_item_result:
                parameter_item_mapping[str(row.id)] = {
                    "name": row.name,
                    "description": row.description,
                    "value": row.value,
                }

        # Get cohort names for mapping
        if cohort_ids_to_fetch := list(
            set([cid for s in scenarios for cid in s.cohort_ids])
        ):
            query, params = self.queries.get_cohort_mapping(cohort_ids_to_fetch)
            cohort_result = self.db.execute(text(query), params).fetchall()

            for row in cohort_result:
                cohort_mapping[str(row.id)] = row.name

        # Get persona names for mapping
        if persona_ids_to_fetch := list(
            set([s.persona_id for s in scenarios if s.persona_id])
        ):
            query, params = self.queries.get_persona_mapping(persona_ids_to_fetch)
            persona_result = self.db.execute(text(query), params).fetchall()

            for row in persona_result:
                persona_mapping[str(row.id)] = row.name

        return ScenariosListResponse(
            scenarios=scenarios,
            objective_mapping=objective_mapping,
            parameter_item_mapping=parameter_item_mapping,
            cohort_mapping=cohort_mapping,
            persona_mapping=persona_mapping,
        )

    def get_scenario_detail(
        self, request: ScenarioDetailRequest
    ) -> ScenarioDetailResponse:
        """Get detailed scenario information using dynamic SQL."""

        # Get scenario basic info
        scenario_query = text("""
        SELECT 
            s.name,
            s.problem_statement,
            s.active,
            s.default_scenario,
            s.department_id
        FROM scenarios s
        WHERE s.id = :scenario_id
        """)

        scenario = self.db.execute(
            scenario_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        if not scenario:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Get persona_id
        persona_query = text("""
        SELECT persona_id FROM scenario_personas 
        WHERE scenario_id = :scenario_id AND active = true
        """)

        persona_result = self.db.execute(
            persona_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        persona_id = str(persona_result.persona_id) if persona_result else None

        # Get document_ids
        doc_query = text("""
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = :scenario_id AND active = true
        """)

        document_ids = [
            str(row.document_id)
            for row in self.db.execute(
                doc_query, {"scenario_id": request.scenarioId}
            ).fetchall()
        ]

        # Get objective_ids
        obj_query = text("""
        SELECT (scenario_id::text || '_' || idx::text) as objective_id, objective
        FROM scenario_objectives
        WHERE scenario_id = :scenario_id
        ORDER BY idx
        """)

        obj_result = self.db.execute(
            obj_query, {"scenario_id": request.scenarioId}
        ).fetchall()

        objective_ids = [row.objective_id for row in obj_result]
        objective_mapping = {row.objective_id: row.objective for row in obj_result}

        # Get parameters grouped by parameter_id
        param_query = text("""
        SELECT 
            pi.parameter_id,
            spi.parameter_item_id
        FROM scenario_parameter_items spi
        JOIN parameter_items pi ON pi.id = spi.parameter_item_id
        WHERE spi.scenario_id = :scenario_id AND spi.active = true
        """)

        param_result = self.db.execute(
            param_query, {"scenario_id": request.scenarioId}
        ).fetchall()

        # Group by parameter_id
        parameters_dict: Dict[str, ParameterDetail] = {}
        selected_param_ids = set()

        for row in param_result:
            param_id = str(row.parameter_id)
            param_item_id = str(row.parameter_item_id)
            selected_param_ids.add(param_id)

            if param_id not in parameters_dict:
                parameters_dict[param_id] = ParameterDetail(
                    parameter_item_ids=[], valid_parameter_item_ids=[]
                )

            parameters_dict[param_id].parameter_item_ids.append(param_item_id)

        # Get valid parameter items for each parameter
        if selected_param_ids:
            valid_params_query = text("""
            SELECT 
                pi.parameter_id,
                pi.id as parameter_item_id
            FROM parameter_items pi
            WHERE pi.parameter_id = ANY(:parameter_ids) AND pi.active = true
            """)

            valid_params_result = self.db.execute(
                valid_params_query, {"parameter_ids": list(selected_param_ids)}
            ).fetchall()

            for row in valid_params_result:
                param_id = str(row.parameter_id)
                param_item_id = str(row.parameter_item_id)

                if param_id in parameters_dict:
                    parameters_dict[param_id].valid_parameter_item_ids.append(
                        param_item_id
                    )

        # Get active simulation_ids
        sim_query = text("""
        SELECT simulation_id FROM simulation_scenarios 
        WHERE scenario_id = :scenario_id AND active = true
        """)

        active_simulation_ids = [
            str(row.simulation_id)
            for row in self.db.execute(
                sim_query, {"scenario_id": request.scenarioId}
            ).fetchall()
        ]

        # Get user's accessible department IDs
        user_dept_query = text("""
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = :profile_id AND d.active = true
        """)

        dept_ids = [
            str(row.id)
            for row in self.db.execute(
                user_dept_query, {"profile_id": request.profileId}
            ).fetchall()
        ]

        # Get valid personas
        valid_personas_query = text("""
        SELECT id, name FROM personas 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """)

        persona_results = self.db.execute(
            valid_personas_query, {"dept_ids": dept_ids}
        ).fetchall()

        valid_persona_ids = [str(row.id) for row in persona_results]
        persona_mapping = {str(row.id): row.name for row in persona_results}

        # Get valid documents
        valid_docs_query = text("""
        SELECT id, name FROM documents 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """)

        doc_results = self.db.execute(
            valid_docs_query, {"dept_ids": dept_ids}
        ).fetchall()

        valid_document_ids = [str(row.id) for row in doc_results]
        document_mapping = {str(row.id): row.name for row in doc_results}

        # Get simulation mapping
        simulation_mapping = {}
        if active_simulation_ids:
            sim_mapping_query = text("""
            SELECT id, title FROM simulations WHERE id = ANY(:sim_ids)
            """)

            sim_mapping_result = self.db.execute(
                sim_mapping_query, {"sim_ids": active_simulation_ids}
            ).fetchall()

            for row in sim_mapping_result:
                simulation_mapping[str(row.id)] = row.title

        # Get parameter mapping
        parameter_mapping = {}
        all_param_item_ids = list(
            set(
                [
                    pid
                    for param_detail in parameters_dict.values()
                    for pid in param_detail.parameter_item_ids
                    + param_detail.valid_parameter_item_ids
                ]
            )
        )

        if all_param_item_ids:
            param_mapping_query = text("""
            SELECT DISTINCT
                p.id as parameter_id,
                p.name,
                p.description
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            WHERE pi.id = ANY(:param_item_ids)
            """)

            param_mapping_result = self.db.execute(
                param_mapping_query, {"param_item_ids": all_param_item_ids}
            ).fetchall()

            for row in param_mapping_result:
                parameter_mapping[str(row.parameter_id)] = {
                    "name": row.name,
                    "description": row.description,
                }

        # Get parameter_item mapping (already built above)
        param_item_full_mapping = {}
        if all_param_item_ids:
            param_item_mapping_query = text("""
            SELECT 
                pi.id,
                pi.name,
                pi.description,
                pi.value
            FROM parameter_items pi
            WHERE pi.id = ANY(:param_item_ids)
            """)

            param_item_mapping_result = self.db.execute(
                param_item_mapping_query, {"param_item_ids": all_param_item_ids}
            ).fetchall()

            for row in param_item_mapping_result:
                param_item_full_mapping[str(row.id)] = {
                    "name": row.name,
                    "description": row.description,
                    "value": row.value,
                }

        return ScenarioDetailResponse(
            # Basic fields
            name=scenario.name,
            problem_statement=scenario.problem_statement,
            active=scenario.active,
            default_scenario=scenario.default_scenario,
            # IDs
            persona_id=persona_id,
            valid_persona_ids=valid_persona_ids,
            document_ids=document_ids,
            valid_document_ids=valid_document_ids,
            # Objectives
            objective_ids=objective_ids,
            valid_objectives=[],  # Empty (free-form)
            # Parameters
            parameters=parameters_dict,
            # Simulations
            active_simulation_ids=active_simulation_ids,
            # Mappings
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=param_item_full_mapping,
            simulation_mapping=simulation_mapping,
            persona_mapping=persona_mapping,
            document_mapping=document_mapping,
            objective_mapping=objective_mapping,
        )

    def get_scenario_detail_default(
        self, request: ScenarioDetailDefaultRequest
    ) -> ScenarioDetailResponse:
        """Get default scenario details based on profile."""

        # Get first active scenario from user's departments
        scenario_query = text("""
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_scenarios AS (
            SELECT s.*
            FROM scenarios s
            JOIN user_departments ud ON ud.department_id = s.department_id
            WHERE s.active = true
            ORDER BY s.default_scenario ASC, s.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_scenarios
        """)

        scenario = self.db.execute(
            scenario_query, {"profile_id": request.profileId}
        ).fetchone()

        if not scenario:
            raise ValueError("No scenarios found for user's departments")

        # Reuse detail logic
        detail_request = ScenarioDetailRequest(
            scenarioId=str(scenario.id), profileId=request.profileId
        )

        return self.get_scenario_detail(detail_request)

    def create_scenario(
        self, request: CreateScenarioRequest
    ) -> CreateScenarioResponse:
        """Create a new scenario using dynamic SQL."""

        # Insert scenario
        create_query = text("""
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES (
            :name,
            :problem_statement,
            :department_id,
            :active,
            :default_scenario
        )
        RETURNING id
        """)

        result = self.db.execute(
            create_query,
            {
                "name": request.name,
                "problem_statement": request.problem_statement,
                "department_id": request.department_id,
                "active": request.active,
                "default_scenario": request.default_scenario,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create scenario")

        scenario_id = str(result.id)

        # Insert persona relationship
        if request.persona_id:
            persona_query = text("""
            INSERT INTO scenario_personas (scenario_id, persona_id, active)
            VALUES (:scenario_id, :persona_id, true)
            """)

            self.db.execute(
                persona_query,
                {"scenario_id": scenario_id, "persona_id": request.persona_id},
            )

        # Insert document relationships
        for document_id in request.document_ids:
            doc_query = text("""
            INSERT INTO scenario_documents (scenario_id, document_id, active)
            VALUES (:scenario_id, :document_id, true)
            """)

            self.db.execute(
                doc_query, {"scenario_id": scenario_id, "document_id": document_id}
            )

        # Insert objectives
        for idx, obj_id in enumerate(request.objective_ids):
            # If it's a composite ID, parse it; otherwise treat as raw text
            if "_" in obj_id and len(obj_id.split("_")) == 2:
                # Skip - it's a reference to existing objective
                continue
            else:
                # New objective text
                obj_insert_query = text("""
                INSERT INTO scenario_objectives (scenario_id, idx, objective)
                VALUES (:scenario_id, :idx, :objective)
                """)

                self.db.execute(
                    obj_insert_query,
                    {"scenario_id": scenario_id, "idx": idx, "objective": obj_id},
                )

        # Insert parameter relationships
        for parameter_id, parameter_item_ids in request.parameters.items():
            for param_item_id in parameter_item_ids:
                param_query = text("""
                INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
                VALUES (:scenario_id, :parameter_item_id, true)
                """)

                self.db.execute(
                    param_query,
                    {"scenario_id": scenario_id, "parameter_item_id": param_item_id},
                )

        self.db.commit()

        return CreateScenarioResponse(
            success=True,
            scenarioId=scenario_id,
            message=f"Scenario '{request.name}' created successfully",
        )

    def update_scenario(
        self, request: UpdateScenarioRequest
    ) -> UpdateScenarioResponse:
        """Update an existing scenario using dynamic SQL."""

        # Check if scenario exists
        check_query = text("""
        SELECT name FROM scenarios WHERE id = :scenario_id
        """)

        existing = self.db.execute(
            check_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        if not existing:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Update scenario basic fields
        update_query = text("""
        UPDATE scenarios SET
            name = :name,
            problem_statement = :problem_statement,
            department_id = :department_id,
            active = :active,
            default_scenario = :default_scenario,
            updated_at = NOW()
        WHERE id = :scenario_id
        """)

        self.db.execute(
            update_query,
            {
                "scenario_id": request.scenarioId,
                "name": request.name,
                "problem_statement": request.problem_statement,
                "department_id": request.department_id,
                "active": request.active,
                "default_scenario": request.default_scenario,
            },
        )

        # Update persona (delete old, insert new)
        delete_persona_query = text("""
        DELETE FROM scenario_personas WHERE scenario_id = :scenario_id
        """)

        self.db.execute(delete_persona_query, {"scenario_id": request.scenarioId})

        if request.persona_id:
            insert_persona_query = text("""
            INSERT INTO scenario_personas (scenario_id, persona_id, active)
            VALUES (:scenario_id, :persona_id, true)
            """)

            self.db.execute(
                insert_persona_query,
                {"scenario_id": request.scenarioId, "persona_id": request.persona_id},
            )

        # Update documents
        delete_docs_query = text("""
        DELETE FROM scenario_documents WHERE scenario_id = :scenario_id
        """)

        self.db.execute(delete_docs_query, {"scenario_id": request.scenarioId})

        for document_id in request.document_ids:
            insert_doc_query = text("""
            INSERT INTO scenario_documents (scenario_id, document_id, active)
            VALUES (:scenario_id, :document_id, true)
            """)

            self.db.execute(
                insert_doc_query,
                {"scenario_id": request.scenarioId, "document_id": document_id},
            )

        # Update objectives
        delete_obj_query = text("""
        DELETE FROM scenario_objectives WHERE scenario_id = :scenario_id
        """)

        self.db.execute(delete_obj_query, {"scenario_id": request.scenarioId})

        for idx, obj_id in enumerate(request.objective_ids):
            if "_" in obj_id and len(obj_id.split("_")) == 2:
                # Skip existing composite IDs
                continue
            else:
                # New objective
                insert_obj_query = text("""
                INSERT INTO scenario_objectives (scenario_id, idx, objective)
                VALUES (:scenario_id, :idx, :objective)
                """)

                self.db.execute(
                    insert_obj_query,
                    {"scenario_id": request.scenarioId, "idx": idx, "objective": obj_id},
                )

        # Update parameters
        delete_params_query = text("""
        DELETE FROM scenario_parameter_items WHERE scenario_id = :scenario_id
        """)

        self.db.execute(delete_params_query, {"scenario_id": request.scenarioId})

        for parameter_id, parameter_item_ids in request.parameters.items():
            for param_item_id in parameter_item_ids:
                insert_param_query = text("""
                INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
                VALUES (:scenario_id, :parameter_item_id, true)
                """)

                self.db.execute(
                    insert_param_query,
                    {
                        "scenario_id": request.scenarioId,
                        "parameter_item_id": param_item_id,
                    },
                )

        self.db.commit()

        return UpdateScenarioResponse(
            success=True, message=f"Scenario '{request.name}' updated successfully"
        )

    def duplicate_scenario(
        self, request: DuplicateScenarioRequest
    ) -> DuplicateScenarioResponse:
        """Duplicate a scenario using dynamic SQL."""

        # Get original scenario
        select_query = text("""
        SELECT 
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        FROM scenarios
        WHERE id = :scenario_id
        """)

        original = self.db.execute(
            select_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        if not original:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Create duplicate
        insert_query = text("""
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES (
            :name || ' Copy',
            :problem_statement,
            :department_id,
            false,
            false
        )
        RETURNING id
        """)

        new_scenario = self.db.execute(
            insert_query,
            {
                "name": original.name,
                "problem_statement": original.problem_statement,
                "department_id": original.department_id,
            },
        ).fetchone()

        if not new_scenario:
            raise ValueError("Failed to create duplicate scenario")

        new_scenario_id = str(new_scenario.id)

        # Copy persona relationship
        copy_persona_query = text("""
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        SELECT :new_scenario_id, persona_id, active
        FROM scenario_personas
        WHERE scenario_id = :original_scenario_id
        """)

        self.db.execute(
            copy_persona_query,
            {
                "new_scenario_id": new_scenario_id,
                "original_scenario_id": request.scenarioId,
            },
        )

        # Copy document relationships
        copy_docs_query = text("""
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        SELECT :new_scenario_id, document_id, active
        FROM scenario_documents
        WHERE scenario_id = :original_scenario_id
        """)

        self.db.execute(
            copy_docs_query,
            {
                "new_scenario_id": new_scenario_id,
                "original_scenario_id": request.scenarioId,
            },
        )

        # Copy objectives
        copy_obj_query = text("""
        INSERT INTO scenario_objectives (scenario_id, idx, objective)
        SELECT :new_scenario_id, idx, objective
        FROM scenario_objectives
        WHERE scenario_id = :original_scenario_id
        """)

        self.db.execute(
            copy_obj_query,
            {
                "new_scenario_id": new_scenario_id,
                "original_scenario_id": request.scenarioId,
            },
        )

        # Copy parameters
        copy_params_query = text("""
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        SELECT :new_scenario_id, parameter_item_id, active
        FROM scenario_parameter_items
        WHERE scenario_id = :original_scenario_id
        """)

        self.db.execute(
            copy_params_query,
            {
                "new_scenario_id": new_scenario_id,
                "original_scenario_id": request.scenarioId,
            },
        )

        self.db.commit()

        return DuplicateScenarioResponse(
            success=True,
            scenarioId=new_scenario_id,
            message=f"Scenario '{original.name}' duplicated successfully",
        )

    def delete_scenario(
        self, request: DeleteScenarioRequest
    ) -> DeleteScenarioResponse:
        """Delete a scenario using dynamic SQL."""

        # Check if in use
        usage_query = text("""
        SELECT COUNT(*) as usage_count
        FROM simulation_scenarios
        WHERE scenario_id = :scenario_id AND active = true
        """)

        usage = self.db.execute(
            usage_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        if not usage:
            raise ValueError("Failed to check scenario usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete scenario that is in use by simulations")

        # Get name for response
        name_query = text("""
        SELECT name FROM scenarios WHERE id = :scenario_id
        """)

        scenario = self.db.execute(
            name_query, {"scenario_id": request.scenarioId}
        ).fetchone()

        if not scenario:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Delete scenario (cascades will handle junction tables)
        delete_query = text("""
        DELETE FROM scenarios WHERE id = :scenario_id
        """)

        self.db.execute(delete_query, {"scenario_id": request.scenarioId})
        self.db.commit()

        return DeleteScenarioResponse(
            success=True, message=f"Scenario '{scenario.name}' deleted successfully"
        )

