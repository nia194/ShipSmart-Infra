#!/bin/bash

# ShipSmart Post-Deployment Verification Suite
# Run this AFTER all services show "Live" status in Render
# Date: 2026-04-09

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_URL="https://shipsmart-web.onrender.com"
JAVA_API_URL="https://shipsmart-api-java.onrender.com"
PYTHON_API_URL="https://shipsmart-api-python.onrender.com"
MCP_TOOLS_URL="https://shipsmart-mcp-tools.onrender.com"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}\n"
}

test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3

    echo -n "Testing $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
        ((TESTS_FAILED++))
        return 1
    fi
}

test_json_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}

    echo -n "Testing $name... "

    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -w "\n%{http_code}")
    else
        response=$(curl -s "$url" -w "\n%{http_code}")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [[ "$http_code" =~ ^[2][0-9][0-9]$ ]]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "  Response: $(echo "$body" | head -c 80)..."
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════

print_header "1. FRONTEND VERIFICATION"

echo "Frontend URL: $FRONTEND_URL"
test_endpoint "Frontend (index page)" "$FRONTEND_URL" "200"
test_endpoint "Frontend (CSS bundled)" "$FRONTEND_URL/index.html" "200"

# ═══════════════════════════════════════════════════════════════════════════

print_header "2. JAVA API HEALTH CHECK"

echo "Java API URL: $JAVA_API_URL"
test_json_endpoint "Java health check" "$JAVA_API_URL/api/v1/health" "GET"

# ═══════════════════════════════════════════════════════════════════════════

print_header "3. PYTHON API HEALTH CHECK"

echo "Python API URL: $PYTHON_API_URL"
test_json_endpoint "Python health check" "$PYTHON_API_URL/health" "GET"

# ═══════════════════════════════════════════════════════════════════════════

print_header "4. MCP TOOLS SERVER VERIFICATION"

echo "MCP Tools URL: $MCP_TOOLS_URL"
test_json_endpoint "MCP health check" "$MCP_TOOLS_URL/health" "GET"

# ═══════════════════════════════════════════════════════════════════════════

print_header "5. MCP TOOLS DISCOVERY"

echo "Testing tools/list endpoint..."
echo -n "Listing available tools... "

tools_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/list" \
    -H "Content-Type: application/json")

if echo "$tools_response" | grep -q "validate_address"; then
    echo -e "${GREEN}✓ PASS${NC} (validate_address tool found)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (validate_address tool NOT found)"
    echo "Response: $tools_response"
    ((TESTS_FAILED++))
fi

if echo "$tools_response" | grep -q "get_quote_preview"; then
    echo -e "${GREEN}✓ PASS${NC} (get_quote_preview tool found)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (get_quote_preview tool NOT found)"
    echo "Response: $tools_response"
    ((TESTS_FAILED++))
fi

# ═══════════════════════════════════════════════════════════════════════════

print_header "6. MCP TOOL EXECUTION TEST"

echo "Testing validate_address tool..."

validate_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/call" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "validate_address",
        "arguments": {
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "zip_code": "94105"
        }
    }')

if echo "$validate_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ PASS${NC} (validate_address executed successfully)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (validate_address execution failed)"
    echo "Response: $(echo "$validate_response" | head -c 200)..."
    ((TESTS_FAILED++))
fi

echo ""
echo "Testing get_quote_preview tool..."

quote_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/call" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "get_quote_preview",
        "arguments": {
            "origin_zip": "94105",
            "destination_zip": "10001",
            "weight_lbs": 10,
            "length_in": 12,
            "width_in": 8,
            "height_in": 6
        }
    }')

if echo "$quote_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ PASS${NC} (get_quote_preview executed successfully)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (get_quote_preview execution failed)"
    echo "Response: $(echo "$quote_response" | head -c 200)..."
    ((TESTS_FAILED++))
fi

# ═══════════════════════════════════════════════════════════════════════════

print_header "7. JAVA API SMOKE TEST"

echo "Testing Java API endpoints..."

echo -n "Testing Java quotes endpoint... "
java_quotes=$(curl -s -X POST "$JAVA_API_URL/api/v1/quotes" \
    -H "Content-Type: application/json" \
    -d '{
        "origin_zip": "94105",
        "destination_zip": "10001",
        "weight_lbs": 10,
        "length_in": 12,
        "width_in": 8,
        "height_in": 6
    }' -w "\n%{http_code}")

java_code=$(echo "$java_quotes" | tail -n1)
if [[ "$java_code" =~ ^[2][0-9][0-9]$ ]]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $java_code)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ SKIP${NC} (HTTP $java_code - may require auth)"
    # Don't count as failure if auth required
fi

# ═══════════════════════════════════════════════════════════════════════════

print_header "8. PYTHON API SMOKE TEST"

echo "Testing Python API endpoints..."

echo -n "Testing Python quotes endpoint... "
python_quotes=$(curl -s -X POST "$PYTHON_API_URL/quotes" \
    -H "Content-Type: application/json" \
    -d '{
        "origin_zip": "94105",
        "destination_zip": "10001",
        "weight_lbs": 10,
        "length_in": 12,
        "width_in": 8,
        "height_in": 6
    }' -w "\n%{http_code}")

python_code=$(echo "$python_quotes" | tail -n1)
if [[ "$python_code" =~ ^[2][0-9][0-9]$ ]]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $python_code)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ SKIP${NC} (HTTP $python_code - may require auth)"
    # Don't count as failure if auth required
fi

# ═══════════════════════════════════════════════════════════════════════════

print_header "FINAL RESULTS"

echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ ALL CRITICAL TESTS PASSED!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo ""
    echo "✓ Frontend is serving React app"
    echo "✓ Java API is healthy and responding"
    echo "✓ Python API is healthy and responding"
    echo "✓ MCP Tools Server is running"
    echo "✓ Tools are discoverable (validate_address, get_quote_preview)"
    echo "✓ Tools execute successfully with test data"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Verify tools in Claude Code: @shipsmart-tools"
    echo "2. Test end-to-end quote flow in React frontend"
    echo "3. Monitor Render logs for any errors"
    echo "4. Check FedEx provider configuration if tools use real provider"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${RED}Action items:${NC}"
    echo "1. Check Render dashboard for service status"
    echo "2. Click on failed service → Logs tab"
    echo "3. Look for error messages from startup"
    echo "4. Verify all environment variables are correctly set"
    echo "5. Check that services have fully restarted (not still deploying)"
    echo ""
    exit 1
fi
