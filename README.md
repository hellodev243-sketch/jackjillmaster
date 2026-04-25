# Jack & Jill Competition System

A real-time dance competition management system with Google Cloud Storage backend and Socket.IO for live updates.

## Features

- **Real-time Updates**: Socket.IO WebSockets on same port as Next.js
- **GCS Storage**: All data stored in Google Cloud Storage
- **Photo Upload**: Drag & drop, camera capture, file browser
- **Secure Admin**: bcrypt-hashed credentials stored in GCS
- **Mobile-Friendly**: Responsive design with camera selfie support
- **Cloud Run Ready**: Dynamic URL detection for any deployment

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Seed Sample Data (Optional)

```bash
npm run seed:data
```

### 3. Start Development Server

```bash
npm run dev
```

Socket.IO runs on the same port (8080) - no separate server needed!

### 4. Access the Application

- Home: http://localhost:8080
- Registration: http://localhost:8080/register
- Admin Login: http://localhost:8080/admin/login
- Display: http://localhost:8080/display

## Scripts

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start development server (Socket.IO on same port) |
| `npm run build`       | Build for production                              |
| `npm run start`       | Start production server                           |
| `npm run init:admin`  | Initialize admin credentials in GCS               |
| `npm run seed:data`   | Seed sample competition data                      |
| `npm run delete:data` | Delete all sample data from GCS                   |

## Cloud Run Deployment

The app automatically detects the deployment URL - no configuration needed!

Socket.IO uses dynamic URL detection:

- Localhost: `http://localhost:8080`
- Cloud Run: `https://your-service-xxxxx.run.app`
- Custom domain: Uses `window.location.host`

## Environment Variables

Create `.env.local`:

```env
GOOGLE_CLOUD_PROJECT=jackjill-481622
GCS_BUCKET_NAME=jack_jill_data
GOOGLE_APPLICATION_CREDENTIALS=./gcs_key.json
```

Note: `NEXT_PUBLIC_SOCKET_URL` is optional - the app auto-detects the URL.

## GCS Folder Structure

```
jack_jill_data/
├── admin/
│   └── admin.json              # Admin credentials
├── events/
│   └── {event_id}/
│       ├── metadata.json       # Event data
│       └── competitors/
│           └── photos/         # Competitor photos
└── ...
```

## Socket.IO Events

See [docs/API-STRUCTURE.md](docs/API-STRUCTURE.md) for complete event contracts.

## Documentation

- [API Structure](docs/API-STRUCTURE.md) - API endpoints and Socket.IO events
- [Software Guide](docs/SOFTWARE-GUIDE.md) - Complete user guide

## Tech Stack

- Next.js 16
- React 19
- Socket.IO (Pages API integration)
- Google Cloud Storage
- Tailwind CSS
- shadcn/ui
- bcryptjs

## License

Private - All rights reserved
