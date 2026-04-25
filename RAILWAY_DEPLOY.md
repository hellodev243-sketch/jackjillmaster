# Railway Deployment Guide

## 🚀 Deploy Jack & Jill Competition App to Railway

This guide will help you deploy your application to Railway (free tier available).

---

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app/)
2. **GitHub Account** - For repository connection
3. **Google Cloud Storage** (Optional) - For data persistence

---

## Quick Start Deployment

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/jack-jill-app.git
   git push -u origin main
   ```

2. **Create New Project on Railway**
   - Go to [railway.app](https://railway.app/)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will automatically detect your Dockerfile and deploy

3. **Configure Environment Variables**
   - Go to your project → Variables tab
   - Add the following environment variables:

### Required Environment Variables

```bash
NODE_ENV=production
PORT=8080
NEXT_TELEMETRY_DISABLED=1

# Google Cloud Storage (for data persistence)
GCS_BUCKET_NAME=your_bucket_name

# Optional: Provide GCS credentials directly
GCS_KEY_JSON={"type":"service_account",...}
# OR use base64 encoded
# GCS_KEY_JSON=base64_encoded_json

# Email (Resend API - optional)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Jack&Jill Events
```

### Option 2: Deploy using Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g railway
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   # From your project directory
   railway init
   # Follow the prompts to create/link a project
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Set Environment Variables**
   ```bash
   # Open variables dashboard
   railway variables set NODE_ENV=production
   railway variables set PORT=8080
   railway variables set GCS_BUCKET_NAME=your_bucket_name

   # Or open the dashboard
   railway variables
   ```

---

## Setting Up Google Cloud Storage (Optional but Recommended)

### Why GCS?
Railway's filesystem is ephemeral. Use Google Cloud Storage for persistent data storage.

### Create GCS Bucket

1. **Go to Google Cloud Console**
   - Navigate to Cloud Storage → Buckets
   - Create a new bucket: `jack_jill_data`

2. **Create Service Account Key**
   ```bash
   # Create service account
   gcloud iam service-accounts create jack-jill-railway \
     --display-name="Jack Jill Railway App"

   # Grant Storage Admin role
   gsutil iam ch serviceAccount:jack-jill-railway@your-project.iam.gserviceaccount.com:roles/storage.objectAdmin \
     gs://jack_jill_data

   # Create and download key
   gcloud iam service-accounts keys create gcs_key.json \
     --iam-account=jack-jill-railway@your-project.iam.gserviceaccount.com
   ```

3. **Add Key to Railway**
   ```bash
   # Option A: Upload JSON file content
   railway variables set GCS_KEY_JSON="$(cat gcs_key.json)"

   # Option B: Base64 encode
   railway variables set GCS_KEY_JSON="$(cat gcs_key.json | base64)"
   ```

---

## Alternative: Railway Volume (Simpler, No GCS)

If you don't want to use Google Cloud Storage, you can use Railway's persistent volume:

1. **Add Volume to your service**
   - In Railway dashboard → Your service → Settings → Volumes
   - Add volume named `data` mounted to `/app/data`

2. **Update your code to use local storage**
   - Contact me if you need help modifying the GCS client code

---

## Health Checks & Monitoring

### Your App Includes Health Check

Railway will automatically use the health check endpoint defined in `railway.toml`:

```
healthcheckPath = "/api/health"
```

### Monitor Logs
```bash
# View real-time logs
railway logs

# View specific service logs
railway logs --service web
```

---

## Domain Configuration

### Custom Domain (Optional)

1. **Go to Settings → Domains** in your Railway dashboard
2. **Add your custom domain**
3. **Update DNS records** as instructed by Railway

### Default Railway URL
Your app will be available at: `https://your-app-name.up.railway.app`

---

## Database Options (If you add one later)

Railway offers built-in database plugins:

### PostgreSQL
```bash
railway add postgresql
railway variables set DATABASE_URL=$POSTGRES_URL
```

### Redis (for caching/sessions)
```bash
railway add redis
railway variables set REDIS_URL=$REDIS_URL
```

---

## Updating Your Deployment

### Automatic Deployments
Railway automatically redeploys when you push to your main branch.

### Manual Deploy
```bash
railway up
```

### Rollback
```bash
railway rollback
```

---

## Troubleshooting

### App Won't Start
1. Check logs: `railway logs`
2. Verify environment variables are set correctly
3. Ensure port 8080 is used (Railway provides PORT env var)

### WebSocket Issues
Railway supports WebSockets natively. Your Socket.IO setup should work without changes.

### GCS Permission Errors
- Verify service account has `storage.objectAdmin` role
- Check bucket name matches GCS_BUCKET_NAME
- Ensure GCS_KEY_JSON is properly formatted

### Cold Starts
- Railway free tier may have cold starts (30-60 seconds)
- Consider upgrading to paid plans for production ($5/month starts)

---

## Cost & Limits

### Free Tier
- $5 free credit every month
- Good for development and light usage
- 512MB RAM, 0.5 vCPU
- Sleeps after inactivity

### Paid Plans
- **MVP**: $5/month - 512MB RAM, always on
- **Startup**: $20/month - 2GB RAM, better performance
- **Business**: $50/month - 4GB RAM, scale as needed

### Monitoring Usage
```bash
railway status
```

---

## Post-Deployment Checklist

- [ ] App is accessible at Railway URL
- [ ] Environment variables are configured
- [ ] Google Cloud Storage is connected (if used)
- [ ] WebSocket connections work (test real-time features)
- [ ] Admin panel is accessible
- [ ] Email sending works (Resend API configured)
- [ ] Health check endpoint responds
- [ ] Custom domain configured (if needed)

---

## Getting Your Railway URL

After deployment:

```bash
# Get your app URL
railway domain

# Or check dashboard
railway open
```

---

## Support

- Railway Documentation: https://docs.railway.app/
- Railway Discord: https://discord.gg/railway
- GitHub Issues: https://github.com/railwayapp/railway/issues

---

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Configure environment variables
3. ✅ Set up Google Cloud Storage (or Railway volumes)
4. ✅ Test all features
5. ✅ Set up custom domain
6. ✅ Monitor and optimize

Your app should now be live on Railway! 🎉
