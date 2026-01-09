"""MCP server for artifacts and resources - unified endpoints."""

from mcp.server.fastmcp import FastMCP

from .endpoints import register_endpoints

# Create MCP server instance
mcp_server = FastMCP("Artifacts-Resources-API", stateless_http=True)

# Register all endpoints
register_endpoints(mcp_server)

__all__ = ["mcp_server"]
