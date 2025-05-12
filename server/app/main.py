# server/app/main.py
import platform
import sys
import time
from typing import Generator

from fastapi import FastAPI, Form, Response
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="My FastAPI Service")


class ChatResponse(BaseModel):
    chat_id: str
    response: str


@app.get("/")
async def root_info():
    """
    Return general server information.
    """
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": (fastapi_version := getattr(sys.modules.get("fastapi"), "__version__", "unknown")),
    }
    return JSONResponse(content={"server_info": info})


@app.get("/health")
async def health_check():
    """
    Simple health check endpoint.
    """
    return {"status": "ok"}


def fake_chat_stream(user_message: str) -> Generator[bytes, None, None]:
    """
    Simulate streaming a chat response back in chunks.
    """
    # A very simple echo + delay demo
    words = f"Echo: {user_message}".split()
    for word in words:
        yield (word + " ").encode("utf-8")
        time.sleep(0.3)
    # indicate end of stream
    yield b""


@app.post("/chat")
async def chat_endpoint(
    message: str = Form(...),
    chat_id: str = Form(...),
):
    """
    Chat endpoint that streams a response back to the client.
    """
    # If you prefer non-streaming, you could do:
    # full_response = f"Echo: {message}"
    # return ChatResponse(chat_id=chat_id, response=full_response)

    # StreamingResponse will flush chunks as they're yielded
    return StreamingResponse(
        fake_chat_stream(message),
        media_type="text/plain",
        headers={"X-Chat-ID": chat_id},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
