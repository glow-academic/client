# app/utils/agents.py

def get_agent_info(agent: str) -> dict:
    """
    Get the agent information for a given agent.
    """
    return {
        "role": "assistant",
        "content": f"This is the profile of the student: {agent}",
    }
