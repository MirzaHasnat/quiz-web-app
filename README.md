# Quiz Web App

A full-stack quiz application with React frontend and Node.js backend.

## Quick Start

### 1. Install Dependencies

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd frontend
npm install
```

### 2. Environment Setup

Create a `.env` file in the `backend` directory with your configuration:
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### 3. Run the Application

From the root directory, run:
```bash
node serve-app.js
```

This will:
- Build the frontend for production
- Start the backend server
- Serve the frontend through the backend at `http://localhost:5001`

## Development Mode

For development with hot reload:

**Backend** (in `backend/` directory):
```bash
npm run dev
```

**Frontend** (in `frontend/` directory):
```bash
npm start
```

## Features

### Authentication & User Management
- User registration and login
- JWT-based authentication
- Role-based access control (Admin/User)
- Password reset functionality

### Quiz Management
- Create and edit quizzes with multiple question types
- Single select, multi-select, and free text questions
- Quiz activation/deactivation controls
- Flexible timing settings (per quiz and per question)
- Negative marking support

### Quiz Taking Experience
- Real-time quiz attempts with auto-save
- Screen and audio recording during attempts
- Timer display with automatic submission
- Question navigation and review
- Recording validation and error handling

### Results & Analytics
- Automatic scoring with negative marking
- Result visibility controls
- Detailed attempt reviews with recordings
- Admin dashboard with user and quiz statistics
- Recording playback for attempt verification

## API Endpoints

- `/api/auth` - Authentication routes
- `/api/users` - User management
- `/api/quizzes` - Quiz operations
- `/api/attempts` - Quiz attempts
- `/api/recordings` - Recording management
- `/api/dashboard` - Dashboard data