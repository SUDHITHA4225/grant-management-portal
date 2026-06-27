# Secure Grant Management Portal

A containerized Node.js/Express API for managing grants with role-based access control, JWT authentication, and OAuth 2.0 support.

## Features
- JWT-based auth for registration and login
- Role-based access control with ADMIN, GRANTOR, GRANTEE roles
- Grant creation, updates, deletion, and application submission
- OAuth 2.0 callback flow for third-party login
- Docker Compose setup with PostgreSQL and Redis
- Jest test suite with coverage reporting

## Prerequisites
- Docker Desktop
- Node.js 20+

## Quick Start
```bash
docker compose up --build
```

The app will be available at http://localhost:3000.

## Environment Variables
Copy .env.example to .env and update the values before running locally.

## Testing
```bash
npm install
npm test
npm run test:coverage
```

## API Overview
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/:provider/callback
- POST /api/users/:userId/roles
- POST /api/grants
- PUT /api/grants/:grantId
- DELETE /api/grants/:grantId
- GET /api/grants
- POST /api/grants/:grantId/apply
- GET /api/grants/:grantId/applications
