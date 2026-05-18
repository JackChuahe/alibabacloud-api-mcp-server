#!/usr/bin/env bash
#
# Publish alibabacloud-mcp-proxy to PyPI.
#
# Usage:
#   ./publish.sh              # publish to production PyPI
#   ./publish.sh --test       # publish to TestPyPI first
#   ./publish.sh --dry-run    # build only, do not upload
#
# Prerequisites:
#   1. pip install build twine
#   2. Configure PyPI credentials via one of:
#      - ~/.pypirc
#      - TWINE_USERNAME / TWINE_PASSWORD env vars
#      - TWINE_USERNAME=__token__  TWINE_PASSWORD=pypi-xxxx  (API token)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
USE_TEST_PYPI=false
DRY_RUN=false

for arg in "$@"; do
    case "$arg" in
        --test)     USE_TEST_PYPI=true ;;
        --dry-run)  DRY_RUN=true ;;
        -h|--help)
            echo "Usage: $0 [--test] [--dry-run]"
            echo "  --test      Upload to TestPyPI instead of production PyPI"
            echo "  --dry-run   Build only, do not upload"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Step 1: Check dependencies
# ---------------------------------------------------------------------------
echo "==> Checking build dependencies..."

for cmd in python3 pip; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: '$cmd' is not installed."
        exit 1
    fi
done

python3 -m pip install --quiet --upgrade build twine

# ---------------------------------------------------------------------------
# Step 1.5: Verify the local version has not already been published
# ---------------------------------------------------------------------------
echo "==> Verifying local version is newer than the published one..."

PACKAGE_NAME="$(python3 -c 'import tomllib;print(tomllib.load(open("pyproject.toml","rb"))["project"]["name"])')"
LOCAL_VERSION="$(python3 -c 'import tomllib;print(tomllib.load(open("pyproject.toml","rb"))["project"]["version"])')"

if [ "$USE_TEST_PYPI" = true ]; then
    INDEX_URL="https://test.pypi.org/pypi/${PACKAGE_NAME}/json"
else
    INDEX_URL="https://pypi.org/pypi/${PACKAGE_NAME}/json"
fi

# curl uses the system CA bundle; --fail surfaces 4xx/5xx as a non-zero exit so
# we can distinguish "package not yet published" (404) from real network errors.
HTTP_CODE="$(curl -sS -o /tmp/.publish_index.json -w "%{http_code}" \
    --connect-timeout 5 --max-time 15 "${INDEX_URL}" || true)"

case "$HTTP_CODE" in
    200)
        PUBLISHED_VERSION="$(python3 -c "
import json, sys
from packaging.version import Version
data = json.load(open('/tmp/.publish_index.json'))
releases = list(data.get('releases', {}).keys())
print(sorted(releases, key=Version)[-1] if releases else '')
")"
        if [ -z "$PUBLISHED_VERSION" ]; then
            echo "    PyPI knows the package but lists no releases yet. Proceeding with ${LOCAL_VERSION}."
        elif python3 -c "
from packaging.version import Version
import sys
sys.exit(0 if Version('${LOCAL_VERSION}') > Version('${PUBLISHED_VERSION}') else 1)
" ; then
            echo "    Local ${LOCAL_VERSION} > published ${PUBLISHED_VERSION}. OK."
        else
            echo "Error: local version ${LOCAL_VERSION} is not newer than published ${PUBLISHED_VERSION}."
            echo "       Bump 'version' in pyproject.toml before publishing."
            exit 1
        fi
        ;;
    404)
        echo "    No prior release detected for ${PACKAGE_NAME} on this index. Proceeding with ${LOCAL_VERSION}."
        ;;
    *)
        echo "Error: failed to query ${INDEX_URL} (HTTP ${HTTP_CODE:-no-response})."
        echo "       Refusing to publish without confirming the latest published version."
        echo "       Re-run when the network is reachable, or skip with: VERSION_CHECK=skip ./publish.sh ..."
        if [ "${VERSION_CHECK:-}" = "skip" ]; then
            echo "    VERSION_CHECK=skip set; bypassing the safety check at your own risk."
        else
            exit 1
        fi
        ;;
esac
rm -f /tmp/.publish_index.json

# ---------------------------------------------------------------------------
# Step 2: Clean previous builds
# ---------------------------------------------------------------------------
echo "==> Cleaning previous builds..."
rm -rf dist/ build/
find src/ -name '*.egg-info' -type d -exec rm -rf {} + 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 3: Build
# ---------------------------------------------------------------------------
echo "==> Building package..."
python3 -m build

echo ""
echo "==> Built artifacts:"
ls -lh dist/

# ---------------------------------------------------------------------------
# Step 4: Verify
# ---------------------------------------------------------------------------
echo ""
echo "==> Verifying package with twine..."
python3 -m twine check dist/*

# ---------------------------------------------------------------------------
# Step 5: Upload
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "==> Dry run complete. Skipping upload."
    echo "    To upload manually:"
    echo "      python3 -m twine upload dist/*"
    exit 0
fi

echo ""
if [ "$USE_TEST_PYPI" = true ]; then
    echo "==> Uploading to TestPyPI..."
    python3 -m twine upload --repository testpypi dist/*
    echo ""
    echo "==> Done! Install from TestPyPI with:"
    echo "    pip install --index-url https://test.pypi.org/simple/ alibabacloud.mcp-proxy"
else
    echo "==> Uploading to PyPI..."
    python3 -m twine upload dist/*
    echo ""
    echo "==> Done! Install with:"
    echo "    pip install alibabacloud.mcp-proxy"
fi
