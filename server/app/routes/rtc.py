import os

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class IceConfig(BaseModel):
    urls: list[str]
    username: str | None = None
    credential: str | None = None

@router.get("/ice", response_model=IceConfig)
def ice() -> IceConfig:
    # Public IP or DNS of the TURN server (use your prod hostname later)
    host = os.getenv("TURN_PUBLIC_IP", "localhost")
    realm = os.getenv("TURN_REALM", "example.com")
    user  = "webrtc"
    pwd   = os.getenv("TURN_PASS", "changeMe")

    return IceConfig(
        urls=[
            f"stun:{host}:3478",
            f"turn:{host}:3478?transport=udp",
            f"turn:{host}:3478?transport=tcp",
        ],
        username=f"{user}",
        credential=pwd,
    )
