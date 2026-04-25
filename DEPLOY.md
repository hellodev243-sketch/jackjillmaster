# Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud SDK** installed and configured

    ```bash
    # Install gcloud CLI: https://cloud.google.com/sdk/docs/install
    gcloud --version
    ```

2. **Docker** installed (for local testing)

3. **GCP Project** with billing enabled

4. **GCS Bucket** created (`jack_jill_data`)

---

## Quick Deploy Commands

### Option 1: Using gcloud CLI directly

```bash
# 1. Set your project ID
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com storage.googleapis.com

# 3. Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/jack-jill-competition

# 4. Deploy to Cloud Run
gcloud run deploy jack-jill-competition \
  --image gcr.io/YOUR_PROJECT_ID/jack-jill-competition \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,GCS_BUCKET_NAME=jack_jill_data" \
  --session-affinity
```

### Option 2: Using the deploy script

```bash
# Edit deploy.sh and update PROJECT_ID, REGION, etc.
chmod +x deploy.sh
./deploy.sh
```

---

## Step-by-Step Guide

### 1. Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  storage.googleapis.com
```

### 3. Set Up GCS Bucket Permissions

The Cloud Run service account needs access to your GCS bucket:

```bash
# Get the default compute service account
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Storage Admin role to the bucket
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://jack_jill_data
```

### 4. Build the Docker Image

```bash
# Build using Cloud Build (recommended)
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/jack-jill-competition

# OR build locally and push
docker build -t gcr.io/YOUR_PROJECT_ID/jack-jill-competition .
docker push gcr.io/YOUR_PROJECT_ID/jack-jill-competition
```

### 5. Deploy to Cloud Run

```bash
gcloud run deploy jack-jill-competition \
  --image gcr.io/YOUR_PROJECT_ID/jack-jill-competition \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "GCS_BUCKET_NAME=jack_jill_data" \
  --session-affinity
```

### 6. Get the Service URL

```bash
gcloud run services describe jack-jill-competition \
  --region asia-southeast1 \
  --format 'value(status.url)'
```

---

## Environment Variables

| Variable                         | Description                 | Default                    |
| -------------------------------- | --------------------------- | -------------------------- |
| `NODE_ENV`                       | Environment mode            | `production`               |
| `PORT`                           | Server port                 | `8080`                     |
| `GCS_BUCKET_NAME`                | GCS bucket name             | `jack_jill_data`           |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key | Auto-detected on Cloud Run |

---

## Important Notes for WebSocket Support

Cloud Run supports WebSocket connections with these considerations:

1. **Session Affinity**: Use `--session-affinity` flag to route requests from the same client to the same instance

2. **Timeout**: Set appropriate timeout (default 300s) for long-lived connections

3. **Min Instances**: Consider setting `--min-instances 1` to avoid cold starts affecting WebSocket connections

4. **Concurrency**: Adjust `--concurrency` based on expected WebSocket connections per instance

---

## Updating the Deployment

```bash
# Rebuild and redeploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/jack-jill-competition

gcloud run deploy jack-jill-competition \
  --image gcr.io/YOUR_PROJECT_ID/jack-jill-competition \
  --region asia-southeast1
```

---

## Viewing Logs

```bash
# Stream logs
gcloud run logs tail jack-jill-competition --region asia-southeast1

# View recent logs
gcloud run logs read jack-jill-competition --region asia-southeast1 --limit 100
```

---

## Troubleshooting

### WebSocket Connection Issues

-   Ensure `--session-affinity` is enabled
-   Check if the client is using the correct URL (https, not http)
-   Verify timeout settings

### GCS Permission Errors

-   Verify service account has `storage.objectAdmin` role on the bucket
-   Check bucket name is correct

### Cold Start Issues

-   Set `--min-instances 1` to keep at least one instance warm
-   Optimize Docker image size

---

## Cost Optimization

-   Use `--min-instances 0` for development/testing
-   Set appropriate `--max-instances` limit
-   Use `--cpu-throttling` for non-latency-sensitive workloads
