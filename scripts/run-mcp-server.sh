#!/bin/bash
# Start the MCP server locally for tool access via HTTP.
#
# Usage:
#   bash scripts/run-mcp-server.sh
#
# Assumes ShipSmart-API is cloned as a sibling of ShipSmart-Infra.
#
# This starts the MCP server on port 8001 exposing:
#   - validate_address
#   - get_quote_preview
#
# Then you can:
#   1. Update .mcp.json to add the local server
#   2. Restart Claude Code
#   3. Tools will be discoverable and callable
#
# For Render deployment, see docs/mcp-render-deployment.md

set -e

INFRA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_DIR="$(cd "$INFRA_ROOT/../ShipSmart-API" && pwd)"

echo "🚀 Starting ShipSmart MCP Server..."
echo "Port: 8001"
echo "Health check: http://localhost:8001/health"
echo "Tools list: http://localhost:8001/tools/list"
echo ""
echo "Press Ctrl+C to stop."
echo ""

cd "$PYTHON_DIR"

uv run uvicorn app.mcp_server:app \
    --host 0.0.0.0 \
    --port 8001 \
    --reload \
    --log-level info
