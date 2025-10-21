"""Breadcrumb queries - SQL query builders for entity name lookups."""

from typing import Any


class BreadcrumbQueries:
    """Query builders for breadcrumb entity name lookups."""

    def get_cohort_title(self, cohort_id: str) -> tuple[str, list[Any]]:
        """Get cohort title by ID.
        
        Args:
            cohort_id: Cohort UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT title
        FROM cohorts
        WHERE id = $1 AND active = true
        """
        return query, [cohort_id]

    def get_persona_name(self, persona_id: str) -> tuple[str, list[Any]]:
        """Get persona name by ID.
        
        Args:
            persona_id: Persona UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM personas
        WHERE id = $1 AND active = true
        """
        return query, [persona_id]

    def get_scenario_name(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Get scenario name by ID.
        
        Args:
            scenario_id: Scenario UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM scenarios
        WHERE id = $1 AND active = true
        """
        return query, [scenario_id]

    def get_simulation_title(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Get simulation title by ID.
        
        Args:
            simulation_id: Simulation UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT title
        FROM simulations
        WHERE id = $1 AND active = true
        """
        return query, [simulation_id]

    def get_document_name(self, document_id: str) -> tuple[str, list[Any]]:
        """Get document name by ID.
        
        Args:
            document_id: Document UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM documents
        WHERE id = $1 AND active = true
        """
        return query, [document_id]

    def get_profile_name(self, profile_id: str) -> tuple[str, list[Any]]:
        """Get profile full name by ID.
        
        Args:
            profile_id: Profile UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT first_name || ' ' || last_name as name
        FROM profiles
        WHERE id = $1 AND active = true
        """
        return query, [profile_id]

    def get_parameter_name(self, parameter_id: str) -> tuple[str, list[Any]]:
        """Get parameter name by ID.
        
        Args:
            parameter_id: Parameter UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM parameters
        WHERE id = $1 AND active = true
        """
        return query, [parameter_id]

    def get_rubric_name(self, rubric_id: str) -> tuple[str, list[Any]]:
        """Get rubric name by ID.
        
        Args:
            rubric_id: Rubric UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM rubrics
        WHERE id = $1 AND active = true
        """
        return query, [rubric_id]

    def get_department_title(self, department_id: str) -> tuple[str, list[Any]]:
        """Get department title by ID.
        
        Args:
            department_id: Department UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT title
        FROM departments
        WHERE id = $1 AND active = true
        """
        return query, [department_id]

    def get_agent_name(self, agent_id: str) -> tuple[str, list[Any]]:
        """Get agent name by ID.
        
        Args:
            agent_id: Agent UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM agents
        WHERE id = $1 AND active = true
        """
        return query, [agent_id]

    def get_provider_name(self, provider_id: str) -> tuple[str, list[Any]]:
        """Get provider name by ID.
        
        Args:
            provider_id: Provider UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT name
        FROM providers
        WHERE id = $1
        """
        return query, [provider_id]

    def get_chat_title(self, chat_id: str) -> tuple[str, list[Any]]:
        """Get assistant chat title by ID.
        
        Args:
            chat_id: Assistant chat UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT title
        FROM assistant_chats
        WHERE id = $1
        """
        return query, [chat_id]

    def get_attempt_simulation_title(self, attempt_id: str) -> tuple[str, list[Any]]:
        """Get simulation title for an attempt by attempt ID.
        
        Args:
            attempt_id: Simulation attempt UUID
            
        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT s.title
        FROM simulation_attempts sa
        JOIN simulations s ON s.id = sa.simulation_id
        WHERE sa.id = $1 AND s.active = true
        """
        return query, [attempt_id]

