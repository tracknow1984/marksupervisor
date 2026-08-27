# Supervisor365 multi-company onboarding architecture

## Phase 1 — company identity and onboarding

Public routes:
- `GET /signup` — public company registration form.
- `GET /login` — company/user login.
- `GET /onboarding` — authenticated company onboarding workspace.
- `GET /api/public/abn-lookup` — local ABN validation plus ABR Lookup when `ABR_GUID` is configured.

Company signup fields:
- Company Name
- ABN
- Contact Name
- Contact Email
- Accounts Contact
- Accounts Phone Number
- Accounts Email (optional)
- Business Type: Transport, Civil, Hire Company, Asset Management, Other
- Requested administrator Username
- Password

Every company gets an immutable `companyId`. Every company user, session and employee credential created by the onboarding layer carries the same `companyId`.

## Authentication

- Passwords are salted and hashed with Node `crypto.scrypt`.
- Session identifiers are random 256-bit tokens; only SHA-256 hashes of session tokens are persisted.
- Session cookie is HttpOnly, SameSite=Lax and Secure in production.
- New employee accounts receive a one-time temporary password and are forced to change it at first login.
- Permanent passwords are never emailed.

## Two-factor authentication

TOTP 2FA is implemented for user profiles.

Requirements:
- Set `SV365_AUTH_ENCRYPTION_KEY` in the runtime environment.
- TOTP secrets are encrypted using AES-256-GCM before persistence.
- Login uses a short-lived 2FA challenge before a full session is issued.

## Single sign-on / one-touch sign-on

The company/user schema contains identity-provider and company SSO configuration fields from day one. Planned providers:
- Microsoft Entra ID / Microsoft 365
- Google Workspace
- Passkeys / WebAuthn one-touch sign-on

Provider status is exposed through `/api/auth/sso-status`. OAuth/OIDC callback flows and WebAuthn credential registration are Phase 2 and must not be described as active until implemented and tested.

## ABN Lookup

Supervisor365 performs the Australian ABN checksum locally. When `ABR_GUID` is configured, the server calls the official ABR JSON service to validate and pre-fill entity details.

Runtime variable:
- `ABR_GUID`

## Email delivery

Nodemailer is used for company confirmation and employee credential delivery.

Runtime variables:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `APP_PUBLIC_URL`

If SMTP is unavailable when a company administrator creates an employee, the one-time temporary password is returned only to the authenticated administrator so it can be delivered securely by another channel.

## Tenant isolation — mandatory migration before public launch

The new account layer is company-aware, but the original Supervisor365 operational stores were built as single-company/global stores. Before multiple customers are allowed into the production operations application, all operational records and queries must be tenant-scoped.

Records requiring `companyId` and server-side filtering include at minimum:
- Employees
- Assets
- GPS links and Wialon configuration
- Pre-starts
- EWD sessions and EWD security records
- Vehicle defects
- Service schedules/history
- Incidents
- Compliance distributions
- Documents and attachments
- Reports
- Dashboard queries

No client-supplied `companyId` should be trusted for access control. The tenant must be derived from the authenticated server session.

## Production persistence

The current onboarding store uses the same file-backed development pattern as the existing Supervisor365 prototype. This is not the final production datastore.

Before public signup goes live, migrate company/auth/session/tenant records to PostgreSQL (or equivalent managed relational storage) with:
- Australian hosting where required by product/compliance policy
- migrations and backups
- unique constraints on ABN, username and email as appropriate
- encrypted secrets
- audit events
- rate limiting and login lockout controls
- password reset/email verification tokens
- CSRF controls for authenticated mutations
- security logging and administrator audit history

## Recommended next sequence

1. PostgreSQL schema and migration layer.
2. Tenant middleware and `companyId` migration across every operational module.
3. Company administration page: company profile, users, roles, subscription/status.
4. Email verification and password reset.
5. Microsoft Entra ID and Google OIDC.
6. Passkeys/WebAuthn.
7. Role/permission matrix: Owner, Company Admin, Operations, Safety & Compliance, Service, Driver.
8. Platform administration for Supervisor365 staff to suspend, support and audit customer companies.
9. Billing/subscription provisioning if required.
10. Security testing before exposing operational data to external companies.
