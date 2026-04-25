# Deploy to Google Cloud Run with environment variables
# This script builds and deploys your app to Cloud Run

$PROJECT_ID = "jackjill-481622"
$SERVICE_NAME = "jack-jill-competition"
$REGION = "us-central1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"
$GCS_BUCKET = "jack_jill_data"

# Email Service Configuration (Resend)
$RESEND_API_KEY = "re_ijpvgy6s_DyVAyfpjSQcTe1LWMhF1KxPD"
$RESEND_FROM_EMAIL = "noreply@jacknjillsoftware.com"
$RESEND_FROM_NAME = "Jack&Jill Events"

Write-Host "Building Docker image..." -ForegroundColor Cyan
gcloud builds submit --tag $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nDeploying to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --traffic LATEST `
    --set-env-vars "NODE_ENV=production,GCS_BUCKET_NAME=$GCS_BUCKET,GOOGLE_CLOUD_KEY_FILE=./gcs_key.json,RESEND_API_KEY=$RESEND_API_KEY,RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL,RESEND_FROM_NAME=$RESEND_FROM_NAME"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    Write-Host "Getting service URL..." -ForegroundColor Cyan
    
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)'
    
    Write-Host "`nCloud Run URL: $SERVICE_URL" -ForegroundColor Green
    Write-Host "`nAll done! Your app is accessible at:" -ForegroundColor Green
    Write-Host "  - Home: $SERVICE_URL" -ForegroundColor Yellow
    Write-Host "  - Admin: $SERVICE_URL/admin/login" -ForegroundColor Yellow
    Write-Host "  - Register: $SERVICE_URL/register" -ForegroundColor Yellow
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    exit 1
}