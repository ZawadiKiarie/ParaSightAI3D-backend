# ParaSightAI Backend Documentation

## Overview

The ParaSightAI backend is a Node.js and Express API server that handles user authentication, profile management, image upload, AI detection communication, report creation, report retrieval, clinical note updates, report confirmation, and PDF export.

The backend connects the React frontend to the detection API and the PostgreSQL database. It also uses Redis for token-based authentication sessions.

## Main Backend Responsibilities

```text
- Register new users
- Sign in existing users
- Sign out users
- Protect private routes using authorization middleware
- Receive uploaded microscopy images
- Send images to the detection API
- Save AI detection results as reports
- Retrieve reports for the logged-in user
- Update clinical notes
- Confirm detection reports
- Export reports as PDF files
```

## Backend Architecture

The backend follows a controller-based structure where each file has a specific responsibility.

Main files/controllers:

```text
server.js
controllers/register.js
controllers/signin.js
controllers/signout.js
controllers/profile.js
controllers/image.js
controllers/reports.js
middleware/authorization.js
```

## server.js

`server.js` is the main backend entry point. It configures the Express server, middleware, routes, static file access, upload handling, and database connection.

Main responsibilities:

```text
- Start the Express server
- Enable CORS
- Parse JSON requests
- Configure multer image upload
- Serve saved report images
- Connect authentication routes
- Connect profile routes
- Connect upload and report routes
```

Important backend routes include:

```text
POST /register
POST /signin
POST /signout
GET  /profile/:id
POST /upload
GET  /reports
GET  /reports/recent
GET  /reports/:id
PATCH /reports/:id/notes
PATCH /reports/:id/confirm
GET  /reports/:id/pdf
```

## Authentication

Authentication is handled using JWT-like tokens stored in Redis. When a user signs in, the backend creates a token and stores it in Redis with the user ID.

The frontend sends this token in the request header:

```text
Authorization: token
```

The backend authorization middleware checks this token before allowing access to protected routes.

## authorization.js

The authorization middleware protects private backend routes.

Main responsibilities:

```text
- Read authorization token from request headers
- Check token in Redis
- Retrieve the logged-in user ID
- Attach user ID to req.userId
- Block unauthorized requests
```

This ensures that users can only access their own uploads, profile, and reports.

## register.js

The registration controller handles creation of new user accounts.

Main responsibilities:

```text
- Validate submitted name, email, and password
- Hash user password using bcrypt
- Save login details in the login table
- Save user details in the users table
- Use a database transaction to keep user/login records consistent
- Return authenticated user session
```

## signin.js

The sign-in controller handles user login.

Main responsibilities:

```text
- Validate submitted email and password
- Find user credentials in the login table
- Compare password with stored hashed password
- Create authentication token
- Store token in Redis
- Return user profile and token to frontend
```

## signout.js

The sign-out controller handles ending a user session.

Main responsibilities:

```text
- Read authorization token from request headers
- Delete token from Redis
- Invalidate the session
```

## profile.js

The profile controller handles user profile retrieval and updates.

Main responsibilities:

```text
- Fetch user profile details
- Update name and email
- Optionally update password
- Keep users and login tables synchronized
- Use a database transaction for safe updates
```

## image.js

The image controller handles communication with the detection API.

Main responsibilities:

```text
- Receive uploaded image path from backend upload route
- Convert image file into FormData
- Send image to the detection API /detect endpoint
- Receive parasite detection results
- Return detection response to the upload route
```

## reports.js

The reports controller handles creation, retrieval, updating, confirmation, and export of detection reports.

Main responsibilities:

```text
- Create a report from AI detection results
- Store analyzed microscopy image for report display
- Save detected parasite, confidence score, bounding box, and status
- Fetch reports belonging only to the authenticated user
- Fetch recent reports for the dashboard
- Fetch full report details
- Update clinical notes
- Confirm AI detection result
- Generate downloadable PDF report
```

## Report Security

Reports are filtered using the authenticated user ID from the authorization middleware.

This means:

```text
- A user only sees their own reports
- Report details are protected
- Notes and confirmation actions are restricted to the report owner
- PDF export is restricted to the report owner
```

## Image Upload Flow

The backend upload workflow is:

```text
User uploads microscopy image from frontend
→ Backend receives image using multer
→ Backend sends image to detection API
→ Detection API returns AI result
→ Backend creates saved report
→ Backend returns detection result and report data to frontend
```

## Report Generation Flow

```text
Detection response received
→ Extract top detection and bounding boxes
→ Save uploaded/analyzed image path
→ Create report record in PostgreSQL
→ Return report summary to frontend
→ User can later open report details or export PDF
```

## Database

The backend uses PostgreSQL with Knex.js.

Main database areas:

```text
users table       Stores user profile information
login table       Stores login credentials and password hashes
reports table     Stores saved AI detection reports
```

## Redis

Redis is used for authentication token storage.

Purpose:

```text
- Store active login sessions
- Validate tokens on protected routes
- Remove tokens during signout
```

## Backend Technologies

```text
Node.js
Express.js
PostgreSQL
Knex.js
Redis
bcrypt
JWT/token authentication
Multer
Axios
FormData
PDFKit
CORS
Docker
```

## Running the Backend

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm start
```

Or, if using a development script:

```bash
npm run dev
```

Environment variables commonly required:

```text
PORT
DATABASE_URL
REDIS_URL
JWT_SECRET
DETECTION_API_URL
```

## Backend Code Quality Notes

The backend uses separation of concerns by placing different responsibilities in different controllers.

Examples:

```text
register.js       Handles registration only
signin.js         Handles login only
signout.js        Handles logout only
profile.js        Handles profile operations
image.js          Handles detection API communication
reports.js        Handles report operations
authorization.js  Handles route protection
```

This improves readability, maintainability, and makes the backend easier to debug and extend.
