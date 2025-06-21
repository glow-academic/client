import asyncio
import json
import random
from typing import Any, AsyncGenerator, Dict, List


async def generate_assistant_response(message: str) -> AsyncGenerator[str, None]:
    """
    Simulate streaming response from an AI assistant with tool calls.
    Replace this with your actual AI model integration.
    """
    # Determine if we should use tool calls based on message content
    should_use_tools = any(keyword in message.lower() for keyword in [
        "search", "find", "look up", "create", "save", "file", "document", 
        "data", "database", "calculate", "compute", "weather", "time", "schedule"
    ])
    
    if should_use_tools and random.random() > 0.3:  # 70% chance to use tools
        # Generate tool calls first
        tools_to_call = _select_tools_for_message(message)
        
        for tool_call in tools_to_call:
            # Emit tool call start
            yield f"<tool_call_start>{json.dumps(tool_call)}</tool_call_start>"
            
            # Simulate tool execution time
            await asyncio.sleep(0.8)
            
            # Generate tool result
            tool_result = await _execute_mock_tool(tool_call)
            
            # Emit tool call result
            yield f"<tool_call_result>{json.dumps(tool_result)}</tool_call_result>"
            
            await asyncio.sleep(0.3)
        
        # Generate response based on tool results
        response_parts = _generate_response_with_tools(message, tools_to_call)
    else:
        # Generate regular response without tools
        response_parts = [
            "I understand you're asking about ",
            f'"{message}". ',
            "Let me help you with that. ",
            "This is a streaming response ",
            "that demonstrates how the ",
            "assistant can provide ",
            "real-time feedback ",
            "as it processes your request. ",
            "Is there anything specific ",
            "you'd like me to clarify?"
        ]
    
    for part in response_parts:
        yield part
        await asyncio.sleep(0.3)  # Simulate processing time


def _select_tools_for_message(message: str) -> List[Dict[str, Any]]:
    """Select appropriate tools based on message content"""
    tools = []
    
    if any(keyword in message.lower() for keyword in ["search", "find", "look up"]):
        tools.append({
            "id": f"search_{random.randint(1000, 9999)}",
            "name": "web_search",
            "type": "read",
            "arguments": {
                "query": message[:50] + "..." if len(message) > 50 else message,
                "max_results": 5
            }
        })
    
    if any(keyword in message.lower() for keyword in ["create", "save", "file"]):
        tools.append({
            "id": f"file_{random.randint(1000, 9999)}",
            "name": "create_file",
            "type": "create",
            "arguments": {
                "filename": "document.txt",
                "content": "Generated content based on your request"
            }
        })
    
    if any(keyword in message.lower() for keyword in ["data", "database", "query"]):
        tools.append({
            "id": f"db_{random.randint(1000, 9999)}",
            "name": "database_query",
            "type": "read",
            "arguments": {
                "table": "users",
                "conditions": {"active": True}
            }
        })
    
    if any(keyword in message.lower() for keyword in ["calculate", "compute", "math"]):
        tools.append({
            "id": f"calc_{random.randint(1000, 9999)}",
            "name": "calculator",
            "type": "read",
            "arguments": {
                "expression": "2 + 2 * 3",
                "precision": 2
            }
        })
    
    return tools[:2]  # Limit to 2 tools max


async def _execute_mock_tool(tool_call: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a mock tool call and return results"""
    tool_name = tool_call["name"]
    
    if tool_name == "web_search":
        return {
            "id": tool_call["id"],
            "name": tool_name,
            "status": "success",
            "result": {
                "results": [
                    {"title": "Example Result 1", "url": "https://example.com/1", "snippet": "This is a relevant search result..."},
                    {"title": "Example Result 2", "url": "https://example.com/2", "snippet": "Another helpful resource..."},
                    {"title": "Example Result 3", "url": "https://example.com/3", "snippet": "Additional information found..."}
                ],
                "total_results": 3
            }
        }
    
    elif tool_name == "create_file":
        return {
            "id": tool_call["id"],
            "name": tool_name,
            "status": "success",
            "result": {
                "filename": tool_call["arguments"]["filename"],
                "size": len(tool_call["arguments"]["content"]),
                "created_at": "2024-01-01T12:00:00Z",
                "path": f"/files/{tool_call['arguments']['filename']}"
            }
        }
    
    elif tool_name == "database_query":
        return {
            "id": tool_call["id"],
            "name": tool_name,
            "status": "success",
            "result": {
                "rows": [
                    {"id": 1, "name": "John Doe", "active": True},
                    {"id": 2, "name": "Jane Smith", "active": True},
                    {"id": 3, "name": "Bob Johnson", "active": True}
                ],
                "count": 3,
                "query_time": "0.045s"
            }
        }
    
    elif tool_name == "calculator":
        return {
            "id": tool_call["id"],
            "name": tool_name,
            "status": "success",
            "result": {
                "expression": tool_call["arguments"]["expression"],
                "result": 8,
                "steps": ["2 + 2 * 3", "2 + 6", "8"]
            }
        }
    
    else:
        return {
            "id": tool_call["id"],
            "name": tool_name,
            "status": "error",
            "error": f"Unknown tool: {tool_name}"
        }


def _generate_response_with_tools(message: str, tool_calls: List[Dict[str, Any]]) -> List[str]:
    """Generate response text that incorporates tool results"""
    response_parts = [
        f"I've analyzed your request about '{message[:30]}...' " if len(message) > 30 else f"I've analyzed your request about '{message}' ",
        "and used several tools to help provide you with accurate information. "
    ]
    
    for tool_call in tool_calls:
        tool_name = tool_call["name"]
        if tool_name == "web_search":
            response_parts.extend([
                "I performed a web search and found several relevant results. ",
                "The search returned multiple helpful resources that address your question. "
            ])
        elif tool_name == "create_file":
            response_parts.extend([
                "I've created a file with the requested content. ",
                "The file has been saved successfully and is ready for use. "
            ])
        elif tool_name == "database_query":
            response_parts.extend([
                "I queried the database and retrieved the relevant information. ",
                "The results show several matching records that might be helpful. "
            ])
        elif tool_name == "calculator":
            response_parts.extend([
                "I performed the mathematical calculation you requested. ",
                "The computation has been completed with step-by-step breakdown. "
            ])
    
    response_parts.extend([
        "Based on the tool results, I can provide you with a comprehensive answer. ",
        "Is there anything specific from these results you'd like me to explain further?"
    ])
    
    return response_parts
