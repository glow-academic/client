# utils/scenario.py


def get_seniority_info(seniority: str) -> dict:
    """
    Get the seniority information for a given seniority.
    """

    seniority_info_string = f"The student is a {seniority}."

    return {
        "role": "assistant",
        "content": f"The following is the seniority information: {seniority_info_string}",
    }

def get_crowdedness_info(crowdedness: int) -> dict:
    """
    Get the crowdedness information for a given crowdedness.
    """

    crowdedness_info_string = f"The scenario has a {crowdedness} level of crowdedness."

    return {
        "role": "assistant",
        "content": f"The following is the crowdedness information, on a scale of 1 to 10 (1 being the least crowded and 10 being the most crowded): {crowdedness_info_string}",
    }

def get_intensity_info(intensity: int) -> dict:
    """
    Get the intensity information for a given intensity.
    """

    intensity_info_string = f"The scenario has a {intensity} level of intensity."

    return {
        "role": "assistant",
        "content": f"The following is the intensity information, on a scale of 1 to 10 (1 being the least intense and 10 being the most intense): {intensity_info_string}",
    }