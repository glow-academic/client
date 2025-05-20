scenario_descriptions = {
    "aggressive": "You are talking to an aggressive student.",
    "happy": "You are talking to a happy student.",
    "confused": "You are talking to a confused student.",
}

chat_titles = {
    "aggressive": "Aggressive Student",
    "happy": "Happy Student",
    "confused": "Confused Student",
}


def get_profile_info(profile: str) -> dict:
    """
    Get the profile information for a given profile.
    """
    return {
        "role": "assistant",
        "content": f"This is the profile of the student: {profile}",
    }
