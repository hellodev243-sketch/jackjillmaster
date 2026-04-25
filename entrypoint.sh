#!/bin/sh
set -e

# Handle Google Cloud credentials from environment variable
# Supports both plain JSON and base64-encoded JSON
if [ -n "$GCS_KEY_JSON" ]; then
  echo "Writing GCS key from environment variable..."
  # Try base64 decode first; if it fails, write plain
  if echo "$GCS_KEY_JSON" | base64 -d > /tmp/gcs_key.json 2>/dev/null; then
    echo "GCS key decoded from base64."
  else
    echo "$GCS_KEY_JSON" > /tmp/gcs_key.json
  fi
  export GOOGLE_APPLICATION_CREDENTIALS="/tmp/gcs_key.json"
  echo "GCS credentials configured."
fi

# Also check for legacy env variable name
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
  echo "Writing GCS key from GOOGLE_APPLICATION_CREDENTIALS_JSON..."
  if echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" | base64 -d > /tmp/gcs_key.json 2>/dev/null; then
    echo "GCS key decoded from base64."
  else
    echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/gcs_key.json
  fi
  export GOOGLE_APPLICATION_CREDENTIALS="/tmp/gcs_key.json"
fi

# Ensure PORT is set
if [ -z "$PORT" ]; then
  export PORT=8080
fi

echo "Starting server on port $PORT..."
exec "$@"
