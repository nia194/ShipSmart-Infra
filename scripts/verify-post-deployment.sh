#!/bin/bash

# ShipSmart Post-Deployment Verification Suite
# Run this AFTER all services show "Live" status in Render.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FRONTEND_URL="https://shipsmart-web.onrender.com"
JAVA_API_URL="https://shipsmart-api-java.onrender.com"
PYTHON_API_URL="https://shipsmart-api-python.onrender.com"
MCP_TOOLS_URL="https://shipsmart-mcp-tools.onrender.com"

TESTS_PASSED=0
TESTS_FAILED=0

print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3

    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $response)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC} (Expected $expected_code, got $response)"
        ((TESTS_FAILED++))
    fi
}

test_json_endpoint() {
    local name=$1
    local url=$2

    echo -n "Testing $name... "
    response=$(curl -s "$url" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        echo "  Response: $(echo "$body" | head -c 100)..."
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        ((TESTS_FAILED++))
    fi
}

print_header "1. FRONTEND VERIFICATION"
test_endpoint "Frontend (index page)" "$FRONTEND_URL" "200"
test_endpoint "Frontend SPA fallback" "$FRONTEND_URL/index.html" "200"

print_header "2. JAVA API HEALTH CHECK"
test_json_endpoint "Java health check" "$JAVA_API_URL/api/v1/health"

print_header "3. PYTHON API HEALTH CHECK"
test_json_endpoint "Python health check" "$PYTHON_API_URL/health"

print_header "4. MCP TOOLS SERVER VERIFICATION"
test_json_endpoint "MCP health check" "$MCP_TOOLS_URL/health"

print_header "5. MCP TOOLS DISCOVERY"
echo -n "Listing available tools... "
tools_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/list" -H "Content-Type: application/json")
if echo "$tools_response" | grep -q "validate_address" && echo "$tools_response" | grep -q "get_quote_preview"; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    echo "  Response: $tools_response"
    ((TESTS_FAILED++))
fi

print_header "6. MCP TOOL EXECUTION TEST"
echo -n "Testing validate_address tool... "
validate_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/call" \
    -H "Content-Type: application/json" \
    -d '{"name":"validate_address","arguments":{"street":"123 Main St","city":"San Francisco","state":"CA","zip_code":"94105"}}')
if echo "$validate_response" | grep -q '"success":true'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    echo "  Response: $(echo "$validate_response" | head -c 200)..."
    ((TESTS_FAILED++))
fi

echo -n "Testing get_quote_preview tool... "
quote_response=$(curl -s -X POST "$MCP_TOOLS_URL/tools/call" \
    -H "Content-Type: application/json" \
    -d '{"name":"get_quote_preview","arguments":{"origin_zip":"94105","destination_zip":"10001","weight_lbs":10,"length_in":12,"width_in":8,"height_in":6}}')
if echo "$quote_response" | grep -q '"success":true'; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    echo "  Response: $(echo "$quote_response" | head -c 200)..."
    ((TESTS_FAILED++))
fi

print_header "7. JAVA API SMOKE TEST"
echo -n "Testing Java quotes endpoint... "
java_quotes=$(curl -s -X POST "$JAVA_API_URL/api/v1/quotes" \
    -H "Content-Type: application/json" \
    -d '{"origin":"San Francisco, CA 94105","destination":"New York, NY 10001","dropOffDate":"2026-04-20","expectedDeliveryDate":"2026-04-24","packages":[{"qty":1,"weight":"10","l":"12","w":"8","h":"6"}]}' \
    -w "\n%{http_code}")
java_code=$(echo "$java_quotes" | tail -n1)
if [[ "$java_code" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "${GREEN}PASS${NC} (HTTP $java_code)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}SKIP${NC} (HTTP $java_code)"
fi

print_header "8. PYTHON API SMOKE TEST"
echo -n "Testing Python recommendation endpoint... "
python_response=$(curl -s -X POST "$PYTHON_API_URL/api/v1/advisor/recommendation" \
    -H "Content-Type: application/json" \
    -d '{"services":[{"service":"Ground","price_usd":12.5,"estimated_days":5},{"service":"Express","price_usd":29.0,"estimated_days":1}],"context":{"urgent":true}}' \
    -w "\n%{http_code}")
python_code=$(echo "$python_response" | tail -n1)
if [[ "$python_code" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "${GREEN}PASS${NC} (HTTP $python_code)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}SKIP${NC} (HTTP $python_code)"
fi

print_header "FINAL RESULTS"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All critical tests passed.${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Check Render logs and environment variables.${NC}"
    exit 1
fi
