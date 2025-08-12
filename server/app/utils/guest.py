from app.models import Profiles
from sqlmodel import Session, select


def find_default_guest_profile(session: Session) -> Profiles | None:
    return session.exec(
        select(Profiles).where(Profiles.role == "guest", Profiles.default_profile == True)
    ).first()
