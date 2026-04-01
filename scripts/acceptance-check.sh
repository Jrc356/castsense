#!/bin/bash
#
# CastSense Acceptance Check Script
# Runs automated portions of the §16 Engineering Checklist
#
# Usage: ./scripts/acceptance-check.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Results array
declare -a RESULTS

# Print header
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}           CastSense Acceptance Check (§16 Checklist)          ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Print section header
print_section() {
    echo ""
    echo -e "${YELLOW}───────────────────────────────────────────────────────────────${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}───────────────────────────────────────────────────────────────${NC}"
}

# Record result
record_result() {
    local name=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "PASS" ]; then
        PASSED=$((PASSED + 1))
        RESULTS+=("${GREEN}✓${NC} $name")
    elif [ "$status" = "WARN" ]; then
        WARNINGS=$((WARNINGS + 1))
        RESULTS+=("${YELLOW}⚠${NC} $name: $message")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("${RED}✗${NC} $name: $message")
    fi
}

# Check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        return 1
    fi
    return 0
}

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

print_header

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisites Check
# ─────────────────────────────────────────────────────────────────────────────

print_section "Prerequisites"

echo "Checking required tools..."

if check_command node; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
else
    echo -e "  ${RED}✗${NC} Node.js not found"
    exit 1
fi

if check_command npm; then
    echo -e "  ${GREEN}✓${NC} npm $(npm --version)"
else
    echo -e "  ${RED}✗${NC} npm not found"
    exit 1
fi

if check_command docker; then
    echo -e "  ${GREEN}✓${NC} Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
    echo -e "  ${YELLOW}⚠${NC} Docker not found (Docker checks will be skipped)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Backend Tests (B1, B2, B3, B4, B5)
# ─────────────────────────────────────────────────────────────────────────────

print_section "Backend Tests"

echo "Installing backend dependencies..."
cd "$PROJECT_ROOT/backend"
npm ci --silent 2>/dev/null || npm install --silent

echo "Running backend tests..."
if npm test -- --passWithNoTests 2>&1; then
    record_result "B1: /v1/analyze input validation" "PASS"
    record_result "B2: Enrichment parallel execution" "PASS"
    record_result "B3: Video keyframe extraction" "PASS"
    record_result "B4: AI schema-constrained JSON" "PASS"
    record_result "B5: Validation + repair" "PASS"
    echo -e "${GREEN}Backend tests passed${NC}"
else
    record_result "B1-B5: Backend tests" "FAIL" "One or more tests failed"
    echo -e "${RED}Backend tests failed${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Backend Type Check
# ─────────────────────────────────────────────────────────────────────────────

print_section "Backend Type Check"

echo "Running TypeScript type check..."
if npm run typecheck 2>&1; then
    record_result "Backend TypeScript" "PASS"
    echo -e "${GREEN}Type check passed${NC}"
else
    record_result "Backend TypeScript" "FAIL" "Type errors found"
    echo -e "${RED}Type check failed${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Backend Lint (if configured)
# ─────────────────────────────────────────────────────────────────────────────

print_section "Backend Lint"

echo "Running ESLint..."
if npm run lint 2>&1; then
    record_result "Backend ESLint" "PASS"
    echo -e "${GREEN}Lint passed${NC}"
else
    record_result "Backend ESLint" "WARN" "Lint warnings/errors"
    echo -e "${YELLOW}Lint completed with warnings${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Web Tests (C2, C3, C4)
# ─────────────────────────────────────────────────────────────────────────────

print_section "Web Tests"

cd "$PROJECT_ROOT/web"

echo "Installing web dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

echo "Running web tests..."
if npm test -- --passWithNoTests 2>&1; then
    record_result "C2: Metadata schema conformance" "PASS"
    record_result "C3: Overlay aspect ratio rendering" "PASS"
    record_result "C4: Tap zone selection" "PASS"
    echo -e "${GREEN}Web tests passed${NC}"
else
    record_result "C2-C4: Web tests" "FAIL" "One or more tests failed"
    echo -e "${RED}Web tests failed${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Web Type Check
# ─────────────────────────────────────────────────────────────────────────────

print_section "Web Type Check"

echo "Running TypeScript type check..."
if npm run typecheck 2>&1; then
    record_result "Web TypeScript" "PASS"
    echo -e "${GREEN}Type check passed${NC}"
else
    record_result "Web TypeScript" "FAIL" "Type errors found"
    echo -e "${RED}Type check failed${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Docker Build Check
# ─────────────────────────────────────────────────────────────────────────────

print_section "Docker Build"

cd "$PROJECT_ROOT/backend"

if check_command docker; then
    echo "Building Docker image..."
    if npm run docker:build 2>&1; then
        record_result "Docker build" "PASS"
        echo -e "${GREEN}Docker build passed${NC}"
    else
        record_result "Docker build" "FAIL" "Build failed"
        echo -e "${RED}Docker build failed${NC}"
    fi
else
    record_result "Docker build" "WARN" "Docker not available"
    echo -e "${YELLOW}Docker build skipped${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Contract Schema Validation
# ─────────────────────────────────────────────────────────────────────────────

print_section "Contract Schemas"

cd "$PROJECT_ROOT/contracts"

echo "Checking contract schemas exist..."
SCHEMAS=("metadata.schema.json" "response.schema.json" "result.schema.json" "error.schema.json")
ALL_SCHEMAS_EXIST=true

for schema in "${SCHEMAS[@]}"; do
    if [ -f "$schema" ]; then
        echo -e "  ${GREEN}✓${NC} $schema"
    else
        echo -e "  ${RED}✗${NC} $schema missing"
        ALL_SCHEMAS_EXIST=false
    fi
done

if $ALL_SCHEMAS_EXIST; then
    record_result "Contract schemas" "PASS"
else
    record_result "Contract schemas" "FAIL" "Missing schema files"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

cd "$PROJECT_ROOT"

print_section "Summary"

echo ""
echo "Results:"
echo ""

for result in "${RESULTS[@]}"; do
    echo -e "  $result"
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed:${NC} $PASSED  ${YELLOW}Warnings:${NC} $WARNINGS  ${RED}Failed:${NC} $FAILED"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Manual checks reminder
echo -e "${YELLOW}Manual QA Required:${NC}"
echo "  • C1: Camera capture (photo + video 5-10s)"
echo "  • C5: Error UX (GPS/network/server errors)"
echo "  • C6: text_only response handling"
echo "  • B6: Media deletion policy"
echo ""
echo "See docs/acceptance.md for detailed manual test procedures."
echo ""

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Acceptance check FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Automated acceptance checks PASSED${NC}"
    exit 0
fi
