# Pawmilya

A pet adoption and rescue management mobile application built with React Native (Expo) and a Node.js/Express backend.

## Features

- **Pet Browsing & Adoption** — Browse available pets and submit adoption applications
- **Rescue Reporting** — Report animals in need of rescue
- **Shelter Management** — Shelters can manage their pets, transfers, and applications
- **Rescuer Registration** — Users can apply to become verified rescuers
- **Admin Dashboard** — Full admin panel for managing users, pets, adoptions, rescues, shelters, and deliveries
- **Real-time Updates** — Socket.IO for live notifications
- **Location Services** — Geocoding and location-based features

## Tech Stack

### Frontend
- **React Native** 0.81 with **Expo** 54
- React Navigation (bottom tabs)
- Expo modules: Image Picker, Location, Speech, Linear Gradient
- AsyncStorage for local persistence
- Socket.IO client

### Backend
- **Node.js** / **Express**
- **PostgreSQL** (via `pg`)
- JWT authentication with token blacklisting
- Multer for file uploads
- Helmet, CORS, rate limiting for security
- Winston for logging
- Socket.IO for real-time communication

## Project Structure

```
Pawmilya/
├── src/                    # React Native frontend
│   ├── components/         # Shared UI components
│   ├── config/             # App configuration
│   ├── constants/          # Theme and constants
│   ├── context/            # React context (Auth)
│   ├── screens/            # App screens
│   │   ├── guest/          # Unauthenticated screens
│   │   ├── user/           # Authenticated user screens
│   │   └── admin/          # Admin panel screens
│   ├── services/           # API service layer
│   └── utils/              # Utility functions
├── backend/                # Express API server
│   ├── config/             # DB, logger, storage config
│   ├── database/           # Schema & migrations
│   ├── middleware/          # Auth & validation middleware
│   └── routes/             # API route handlers
├── assets/                 # Images and static assets
└── android/                # Android native project
```

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **Expo CLI** (`npm install -g expo-cli`)
- Android Studio / Xcode (for device emulation)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd Pawmilya
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Pawmilya
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
PORT=3000
```

### 4. Set up the database

Create a PostgreSQL database named `Pawmilya`, then run the schema:

```bash
psql -U postgres -d Pawmilya -f backend/database/schema.sql
```

Run migrations:

```bash
node backend/run-migrations.js
```

Seed initial data:

```bash
node backend/seed-categories.js
```

### 5. Start the backend server

```bash
cd backend
npm run dev
```

### 6. Start the Expo app

```bash
# From the project root
npm start
```

Scan the QR code with Expo Go or press `a` to open in an Android emulator.

## API Routes

| Route                    | Description                  |
| ------------------------ | ---------------------------- |
| `/api/auth`              | Authentication (login/register) |
| `/api/users`             | User management              |
| `/api/pets`              | Pet listings                 |
| `/api/adoptions`         | Adoption applications        |
| `/api/rescues`           | Rescue reports               |
| `/api/shelters`          | Shelter information          |
| `/api/shelter-transfers` | Shelter transfer requests    |
| `/api/admin`             | Admin operations             |
| `/api/rescuer-applications` | Rescuer applications      |
| `/api/shelter-applications` | Shelter applications      |
| `/api/health`            | Health check                 |

## Scripts

### Frontend
| Command         | Description              |
| --------------- | ------------------------ |
| `npm start`     | Start Expo dev server    |
| `npm run android` | Run on Android         |
| `npm run ios`   | Run on iOS               |
| `npm run web`   | Run in web browser       |

### Backend
| Command         | Description                    |
| --------------- | ------------------------------ |
| `npm start`     | Start production server        |
| `npm run dev`   | Start with nodemon (hot reload)|

## License

This project is private.
