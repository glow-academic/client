"""Breadcrumb generation service."""

import re
from typing import Any

import asyncpg  # type: ignore
from app.queries.breadcrumb_queries import BreadcrumbQueries
from app.schemas.profile import BreadcrumbItem
from app.services.base_service import BaseService


class BreadcrumbService(BaseService):
    """Service for generating breadcrumbs from URL pathnames."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection.
        
        Args:
            conn: asyncpg database connection
        """
        super().__init__(conn)
        self.queries = BreadcrumbQueries()

    def _should_drop_segment(self, segment: str) -> bool:
        """Check if a segment should be dropped from breadcrumbs.
        
        Args:
            segment: URL segment to check
            
        Returns:
            True if segment should be skipped (single letter route markers)
        """
        # Single letter segments like 'c', 'a', 's', 'e', 'p', 'r', 'd'
        return bool(re.match(r"^[a-z]$", segment))

    def _get_section_from_segments(self, segments: list[str]) -> str:
        """Get section identifier from path segments.
        
        Port of client-side getSectionFromSegments() logic.
        
        Args:
            segments: List of path segments
            
        Returns:
            Section identifier for navigation
        """
        if not segments:
            return "dashboard"
        
        first = segments[0] if len(segments) > 0 else ""
        second = segments[1] if len(segments) > 1 else ""
        third = segments[2] if len(segments) > 2 else ""
        fourth = segments[3] if len(segments) > 3 else ""
        
        # Handle main routes
        if first == "home":
            return "home"
        
        elif first == "practice":
            if second == "a" and third:
                return "practice"
            return "practice"
        
        elif first == "progress":
            return "progress"
        
        elif first == "rubric":
            return "rubric"
        
        elif first == "analytics":
            if second == "pricing":
                return "pricing"
            if second:
                return second  # dashboard, reports, history
            return "analytics"
        
        elif first == "cohorts":
            if second == "c" and third:
                return f"cohort-{third}"
            if second == "e" and third:
                return f"cohort-{third}"
            return "cohorts"
        
        elif first == "create":
            if second == "personas":
                if third == "p" and fourth:
                    return f"persona-{fourth}"
                return "personas"
            if second == "scenarios":
                if third == "s" and fourth:
                    return f"scenario-{fourth}"
                return "scenarios"
            if second == "simulations":
                if third == "s" and fourth:
                    return f"simulation-{fourth}"
                return "simulations"
            if second == "documents":
                if third == "d" and fourth:
                    return f"document-{fourth}"
                return "documents"
            return "create"
        
        elif first == "management":
            if second == "staff":
                if third == "p" and fourth:
                    return f"profile-{fourth}"
                return "staff"
            if second == "parameters":
                if third == "p" and fourth:
                    return f"parameter-{fourth}"
                return "parameters"
            if second == "rubrics":
                if third == "r" and fourth:
                    return f"rubric-{fourth}"
                return "rubrics"
            if second == "departments":
                if third == "d" and fourth:
                    return f"department-{fourth}"
                return "departments"
            if second:
                return second  # staff, context, logs, models, rubrics
            return "management"
        
        elif first == "system":
            if second == "agents":
                if third == "a" and fourth:
                    return f"agent-{fourth}"
                return "agents"
            if second == "providers":
                if third == "p" and fourth:
                    return f"provider-{fourth}"
                return "providers"
            if second == "feedback":
                return "feedback"
            if second == "logs":
                return "logs"
            if second == "health":
                return "health"
            return "system"
        
        elif first == "c":
            if second:
                return f"chat-{second}"
            return "progress"  # Chat pages should be under progress section
        
        elif first == "a":
            if second:
                return f"attempt-{second}"
            return "simulations"  # Attempt pages should be under simulations section
        
        elif first == "profile":
            return "profile"
        
        else:
            return "-".join(segments)

    def _get_title_from_segment(self, segment: str) -> str:
        """Get display title from URL segment.
        
        Port of client-side title mapping logic.
        
        Args:
            segment: URL segment
            
        Returns:
            Human-readable title
        """
        # Main sections
        title_map = {
            "home": "Home",
            "practice": "Practice",
            "progress": "Progress",
            "rubric": "Rubric",
            "analytics": "Analytics",
            "simulations": "Simulations",
            "management": "Management",
            "system": "System",
            "profile": "Profile",
            "create": "Create",
            # Subsections
            "overview": "Overview",
            "performance": "Performance",
            "reports": "Reports",
            "departments": "Departments",
            "agents": "Agents",
            "scenarios": "Scenarios",
            "rubrics": "Rubrics",
            "staff": "Staff",
            "providers": "Providers",
            "parameters": "Parameters",
            "documents": "Documents",
            "logs": "Logs",
            "health": "Health",
            "new": "New",
            "edit": "Edit",
            "cohorts": "Cohorts",
            "personas": "Personas",
            "feedback": "Feedback",
            "pricing": "Pricing",
            "dashboard": "Dashboard",
            "leaderboard": "Leaderboard",
        }
        
        if segment in title_map:
            return title_map[segment]
        
        # For IDs, try to make them more readable
        # Only truncate if it looks like an ID (contains dashes and is long)
        if segment and len(segment) > 15 and "-" in segment:
            return f"{segment[:8]}..."
        
        # Default: capitalize first letter
        if segment:
            return segment[0].upper() + segment[1:]
        
        return segment

    async def generate_breadcrumbs(self, pathname: str) -> list[BreadcrumbItem]:
        """Generate breadcrumbs from pathname.
        
        Port of client-side generateBreadcrumbs() logic.

        Args:
            pathname: URL pathname (e.g., '/cohorts/c/123/simulations/s/456')

        Returns:
            List of BreadcrumbItem with title and section for navigation
        """
        segments = [s for s in pathname.split("/") if s]
        breadcrumbs: list[BreadcrumbItem] = []

        for i, segment in enumerate(segments):
            # Skip single letter segments (route markers like 'c', 'a', 's', etc.)
            if self._should_drop_segment(segment):
                continue

            # Get title and section for this breadcrumb
            title = self._get_title_from_segment(segment)
            section = self._get_section_from_segments(segments[: i + 1])

            breadcrumbs.append(BreadcrumbItem(title=title, section=section))

        # Enrich breadcrumbs with database entity names
        breadcrumbs = await self._enrich_breadcrumbs(breadcrumbs)

        return breadcrumbs

    async def _enrich_breadcrumbs(
        self, breadcrumbs: list[BreadcrumbItem]
    ) -> list[BreadcrumbItem]:
        """Enrich breadcrumbs with database entity names.
        
        Replace truncated IDs with actual entity names from database.
        
        Args:
            breadcrumbs: List of breadcrumbs with potentially truncated titles
            
        Returns:
            List of breadcrumbs with enriched titles
        """
        # Entity type to query method mapping
        query_methods = {
            "cohort": self.queries.get_cohort_title,
            "persona": self.queries.get_persona_name,
            "scenario": self.queries.get_scenario_name,
            "simulation": self.queries.get_simulation_title,
            "document": self.queries.get_document_name,
            "profile": self.queries.get_profile_name,
            "parameter": self.queries.get_parameter_name,
            "rubric": self.queries.get_rubric_name,
            "department": self.queries.get_department_title,
            "agent": self.queries.get_agent_name,
            "provider": self.queries.get_provider_name,
            "chat": self.queries.get_chat_title,
            "attempt": self.queries.get_attempt_simulation_title,
        }

        enriched: list[BreadcrumbItem] = []

        for crumb in breadcrumbs:
            # Check if this breadcrumb has a section with entity ID pattern
            if crumb.section:
                # Match patterns like "cohort-{id}", "persona-{id}", etc.
                match = re.match(r"^(cohort|persona|scenario|simulation|document|profile|parameter|rubric|department|agent|provider|chat|attempt)-(.+)$", crumb.section)
                
                if match:
                    entity_type = match.group(1)
                    entity_id = match.group(2)
                    
                    # Get the query method for this entity type
                    query_method = query_methods.get(entity_type)
                    
                    if query_method:
                        try:
                            # Execute query to fetch entity name
                            query, params = query_method(entity_id)
                            result = await self.conn.fetchrow(query, *params)
                            
                            if result:
                                # Extract the name/title from result (first column)
                                entity_name = result[0]
                                
                                # Special handling for attempts - prepend "Attempt: "
                                if entity_type == "attempt" and entity_name:
                                    entity_name = f"Attempt: {entity_name}"
                                
                                # Replace the truncated title with actual name
                                enriched.append(
                                    BreadcrumbItem(title=entity_name, section=crumb.section)
                                )
                                continue
                        except Exception:
                            # If query fails, fall back to original title
                            pass
            
            # Keep original breadcrumb if no enrichment needed or failed
            enriched.append(crumb)

        return enriched

