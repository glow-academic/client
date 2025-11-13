"""MCP server module - exports FastMCP server instance for tool registration."""

from mcp.server.fastmcp import FastMCP

server = FastMCP("Domain-API", stateless_http=True)

