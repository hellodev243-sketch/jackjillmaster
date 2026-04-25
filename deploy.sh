#!/bin/bash

# ============================================
# Google Cloud Run Deployment Script
# Jack & Jill Competition System
# ============================================

# Configuration - UPDATE THESE VALUES
PROJECT_ID="jackjill-481622"          # Your GCP project ID
REGION="us-central1"                   # Cloud Run region
SERVICE_NAME="jack-jill-competition"  # Cloud Run service name
GCS_BUCKET="jack_jill_data"           # Your GCS bucket name

echo "============================================"
echo "Deploying Jack & Jill Competition to Cloud Run"
echo "============================================"

# Set the project
gcloud config set project ${PROJECT_ID}

# Single command: Build from source and deploy (fastest method)
gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 2 \
  --cpu-boost \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,GCS_BUCKET_NAME=${GCS_BUCKET}" \
  --session-affinity

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo ""
echo "Live at: ${SERVICE_URL}"
echo "Admin: ${SERVICE_URL}/admin/login"
