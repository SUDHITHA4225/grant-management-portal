# Project Plan

## User Story 1: Secure Authentication
As an applicant, I want to register and log in securely so that I can access the portal safely.

Acceptance Criteria:
- Users can register with email and password.
- Users receive a JWT after successful login.
- Invalid credentials return a 401 response.

## User Story 2: Role-Based Access Control
As an administrator, I want to assign roles to users so that permissions are enforced consistently.

Acceptance Criteria:
- Only admins can assign roles.
- Role assignments are stored in the database.
- Unauthorized role changes are rejected.

## User Story 3: Grant Management
As a grantor, I want to create, update, and delete grants so that I can manage funding opportunities.

Acceptance Criteria:
- Grantors can create grants and are automatically assigned as owners.
- Grantors can update only grants they own.
- Other grantors cannot modify someone else’s grants.

## User Story 4: Grant Applications
As a grantee, I want to view available grants and submit applications so that I can participate in funding opportunities.

Acceptance Criteria:
- Grantees can view published grants.
- Grantees can submit applications with a proposal.
- Grantors can review applications for grants they own.
