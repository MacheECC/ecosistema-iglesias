#!/bin/sh
set -eu

echo "--- RUNTIME: listing /directus/extensions (max depth 4) ---"
find /directus/extensions -maxdepth 4 -type f -print | sort || true
echo "-----------------------------------------------------------"

echo "--- ENV (selected) ---"
env | grep -E 'EXTENSIONS_PATH|DIRECTUS|NODE|PORT|DB|DATABASE_URL' || true
echo "----------------------"

echo "--- starting directus ---"
exec npx directus start