import asyncio
from typing import AsyncGenerator

async def run_happy_agent(chat_id: str, input_text: str = "") -> AsyncGenerator[str, None]:
    """
    This function is used to run the happy agent.
    Returns a streamable result that yields clean text chunks as they're generated.
    
    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent
        
    Yields:
        Text chunks from the agent's response (currently simulated)
    """
    # Simulated happy response broken into chunks
    response_chunks = [
        "Hello! ",
        "You asked about ",
        f"'{input_text}' ",
        "I am so happy to get help from you! ",
    ]

    # # Get the full result with metadata
    # result = Runner.run_streamed(
    #     agent,
    #     chat_id=chat_id,
    #     input=input_text,
    # )
    
    # # Process streaming events and yield only the text chunks
    # async for event in result.stream_events():
    #     if event.type == "raw_response_event":
    #         if hasattr(event.data, "delta"):  # For ResponseTextDeltaEvent
    #             chunk = event.data.delta
    #             # You can add any cleaning logic here if needed
    #             yield chunk
    
    # # Metadata processing can happen here but won't affect the yielded stream
    # # This allows the function to be used easily in tests
    
    # Simulate streaming by yielding chunks with small delays
    full_response = ""
    for chunk in response_chunks:
        # Add a small random delay to simulate network/processing time
        await asyncio.sleep(0.1)
        yield chunk
        full_response += chunk
    
    # after yielding all chunks, we can update the database with the full chunks 


