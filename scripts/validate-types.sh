#!/usr/bin/env bash

# TypeScript Type Checking Validation Script
# This script validates that type checking passes after refactoring changes
# and compares against the baseline established before refactoring

set -e

echo "=================================================="
echo "TypeScript Type Checking Validation"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Baseline error count
BASELINE_ERRORS=235

echo "Running type check..."
echo ""

# Run type check and capture output
# Exclude test fixtures with intentionally invalid syntax
TYPE_CHECK_OUTPUT=$(deno check --remote packages/avalon/mod.ts $(find packages/avalon/src -name "*.ts" -o -name "*.tsx" | grep -v "tests/fixtures" | grep -v "node_modules") 2>&1 || true)

# Count errors
ERROR_COUNT=$(echo "$TYPE_CHECK_OUTPUT" | grep -c "ERROR" || echo "0")

# Save output to log file
echo "$TYPE_CHECK_OUTPUT" > type-check-current.log

echo "=================================================="
echo "Results:"
echo "=================================================="
echo ""
echo "Baseline errors: $BASELINE_ERRORS"
echo "Current errors:  $ERROR_COUNT"
echo ""

# Compare against baseline
if [ "$ERROR_COUNT" -eq "$BASELINE_ERRORS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: Error count matches baseline"
    echo ""
    echo "Type checking validation successful!"
    exit 0
elif [ "$ERROR_COUNT" -lt "$BASELINE_ERRORS" ]; then
    IMPROVEMENT=$((BASELINE_ERRORS - ERROR_COUNT))
    echo -e "${GREEN}✓ PASS${NC}: Error count decreased by $IMPROVEMENT"
    echo ""
    echo "Type checking validation successful with improvements!"
    exit 0
else
    REGRESSION=$((ERROR_COUNT - BASELINE_ERRORS))
    echo -e "${RED}✗ FAIL${NC}: Error count increased by $REGRESSION"
    echo ""
    echo "New errors have been introduced!"
    echo ""
    echo "Please review the differences:"
    echo "  - Baseline log: type-check-baseline.log"
    echo "  - Current log:  type-check-current.log"
    echo ""
    echo "To see new errors, run:"
    echo "  diff type-check-baseline.log type-check-current.log"
    exit 1
fi
