#!/bin/bash
#
# Sync raw reports from cloud MCP server to local Mac for processing
#
# Usage:
#   ./sync-from-cloud.sh [SERVER_URL]
#
# Example:
#   ./sync-from-cloud.sh https://sov-quasi-list.up.railway.app
#

set -e

# Configuration
SERVER_URL="${1:-http://localhost:3000}"
RAW_REPORTS_DIR="${RAW_REPORTS_DIR:-/Users/andyseaman/Notebooks/sovereign-credit-system/credit_reports/raw_reports}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Sovereign Reports Sync"
echo "========================================"
echo ""
echo "Server: $SERVER_URL"
echo "Target: $RAW_REPORTS_DIR"
echo ""

# Ensure target directory exists
mkdir -p "$RAW_REPORTS_DIR"

# Get pending files
echo "Checking for pending files..."
PENDING_RESPONSE=$(curl -s "$SERVER_URL/api/sync/pending")
PENDING_COUNT=$(echo "$PENDING_RESPONSE" | jq -r '.count')

if [ "$PENDING_COUNT" == "0" ] || [ "$PENDING_COUNT" == "null" ]; then
    echo -e "${GREEN}✓ No files pending sync${NC}"
    exit 0
fi

echo -e "${YELLOW}Found $PENDING_COUNT file(s) to sync${NC}"
echo ""

# Array to track synced files
SYNCED_FILES=()

# Download each pending file
echo "$PENDING_RESPONSE" | jq -c '.files[]' | while read -r file; do
    FILENAME=$(echo "$file" | jq -r '.filename')
    ORIGINAL_NAME=$(echo "$file" | jq -r '.originalName')
    SIZE=$(echo "$file" | jq -r '.size')

    echo "Downloading: $ORIGINAL_NAME ($SIZE bytes)"

    # Download file
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RAW_REPORTS_DIR/$ORIGINAL_NAME" \
        "$SERVER_URL/api/sync/download/$FILENAME")

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}  ✓ Saved to $RAW_REPORTS_DIR/$ORIGINAL_NAME${NC}"
        # Add to synced list (write to temp file for later)
        echo "$FILENAME" >> /tmp/synced_files.txt
    else
        echo -e "${RED}  ✗ Failed to download (HTTP $HTTP_CODE)${NC}"
    fi
done

# Mark files as synced
if [ -f /tmp/synced_files.txt ]; then
    SYNCED_JSON=$(cat /tmp/synced_files.txt | jq -R . | jq -s '{"filenames": .}')

    echo ""
    echo "Marking files as synced..."

    MARK_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$SYNCED_JSON" \
        "$SERVER_URL/api/sync/mark-synced")

    UPDATED=$(echo "$MARK_RESPONSE" | jq -r '.updated')
    echo -e "${GREEN}✓ Marked $UPDATED file(s) as synced${NC}"

    # Cleanup temp file
    rm /tmp/synced_files.txt
fi

echo ""
echo "========================================"
echo "  Sync Complete"
echo "========================================"

# Show current status
echo ""
echo "Current sync status:"
curl -s "$SERVER_URL/api/sync/status" | jq '.summary'
