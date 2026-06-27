# Secure Grant Management Portal

A secure, containerized backend application for managing grant programs with **Role-Based Access Control (RBAC)**, **JWT Authentication**, **OAuth 2.0 Integration**, **Docker**, **PostgreSQL**, and **Redis**. The project follows the **Model-View-Controller (MVC)** architecture to ensure scalability, maintainability, and secure access management.


---

# Project Structure

```text
secure-grant-management-portal/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── seed/
│   └── app.js
│
├── tests/
├── coverage/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── PROJECT_PLAN.md
└── README.md
```

---

# Database Design

The application includes the following core tables:

* Users
* Roles
* User Roles
* Grants
* Applications

These tables are connected using foreign key relationships to support secure role management and grant workflows.

---

# Authentication

### Local Authentication

* User Registration
* User Login
* JWT Token Generation
* Password Hashing using BCrypt

### OAuth 2.0 Authentication

Supports third-party authentication providers such as:

* Google
* GitHub

After successful authentication, the application creates a user (if necessary) and issues a JWT containing the user's roles.

---

# Role-Based Access Control

### ADMIN

* Assign roles to users
* Manage system permissions

### GRANTOR

* Create grants
* Update grants
* Delete grants
* View applications submitted for their grants

### GRANTEE

* View available grants
* Apply for grants

---

# API Endpoints

## Authentication

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/:provider/callback
```

## User Management

```
POST   /api/users/:userId/roles
```

## Grant Management

```
POST   /api/grants
PUT    /api/grants/:grantId
DELETE /api/grants/:grantId
GET    /api/grants
```

## Grant Applications

```
POST   /api/grants/:grantId/apply
GET    /api/grants/:grantId/applications
```

---

# Environment Variables

Create a `.env` file from `.env.example`.

```env
DATABASE_URL=
JWT_SECRET=

OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=

REDIS_HOST=
REDIS_PORT=

PORT=
NODE_ENV=
```

---

# Running the Project

## Clone Repository

```bash
git clone <repository-url>
cd secure-grant-management-portal
```

## Start Using Docker

```bash
docker compose up --build
```

The application will start automatically after PostgreSQL and Redis become healthy.

Default URL:

```
http://localhost:3000
```

---

# Running Without Docker

Install dependencies

```bash
npm install
```

Run development server

```bash
npm run dev
```

Run production

```bash
npm start
```

---

# Testing

Run all tests

```bash
npm test
```

Generate coverage report

```bash
npm run test:coverage
```

Coverage reports are generated inside:

```
coverage/
```
---

## Conclusion

This project provides a secure and scalable Grant Management Portal using RBAC, JWT, OAuth 2.0, Docker, PostgreSQL, and Redis. It demonstrates modern backend development practices with a clean MVC architecture and secure API design.
