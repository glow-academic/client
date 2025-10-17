"""Assistant schemas for agent execution context."""

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class AssistantRunContext(BaseModel):
    """
    Complete context data needed to run assistant agent.
    Consolidates chat, profile, agent, model, and provider data.
    """

    # Chat data
    chat_id: str
    title: str
    trace_id: Optional[str]
    profile_id: str

    # Profile data
    user_role: str
    user_first_name: str
    user_last_name: str

    # Agent data
    agent_id: str
    agent_name: str
    system_prompt: str
    temperature: float
    reasoning: Optional[str]

    # Model data
    model_id: str
    model_name: str
    custom_model: bool

    # Provider data
    provider_id: str
    provider_name: str
    base_url: Optional[str]
    api_key: str

    # Conversation data
    messages: List[Dict[str, Any]]
    tool_calls: List[Dict[str, Any]]

    @property
    def user_name(self) -> str:
        """Get formatted user name."""
        return f"{self.user_first_name} {self.user_last_name}"

    @property
    def user_role_display(self) -> str:
        """Get display-friendly user role."""
        role_mapping = {
            "superadmin": "Super Administrator",
            "admin": "Administrator",
            "instructional": "Instructional",
            "ta": "GTA",
            "guest": "Guest",
        }
        return role_mapping.get(self.user_role, self.user_role)

