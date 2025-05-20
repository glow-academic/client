from app.models import Classes
from sqlmodel import Session, select


def get_class_info(class_id: str, session: Session) -> dict:
    """
    Get the class information for a given class id.
    """
    class_info = session.exec(
        select(Classes)
        .where(Classes.id == class_id)
    ).first()

    class_name = class_info.name
    class_code = class_info.class_code
    class_description = class_info.description
    class_info_string = f"Class Name: {class_name}\nClass Code: {class_code}\nClass Description: {class_description}"

    return {
        "role": "assistant",
        "content": f"The following is the class information: {class_info_string}",
    }
