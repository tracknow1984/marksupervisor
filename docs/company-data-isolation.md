# Company data separation

## Request boundary

`server.js` starts the authentication gateway. Signup, login, onboarding, profile and company-user endpoints stay in this process. All operational URLs—including APIs, exports, uploaded documents, former public QR portals, compliance links and GPS-share URLs—require a valid company session. The health endpoint is public and returns no records.

The gateway derives the company from the server-side session. Caller-supplied company IDs never select a workspace. Cookies and internal/forwarded identity headers are removed before forwarding. Administrator role headers are recreated from the authenticated user. Temporary-password users must change their password before accessing operations. Cross-site mutations are rejected, and responses use `private, no-store`.

## Operational storage and memory

Each company has one child Node process and a separate directory:

`SV365_DATA_DIR/tenants/SHA256(companyId)/`

This separates the existing file stores and also the legacy module-level arrays, globals, Wialon sessions, caches, background checks and report state. A client request is forwarded only to its company's loopback listener. Workers do not inherit the platform Wialon token or shared account credentials. Company GPS configuration is restored only from that company's own directory.

Assets, employees, asset classes and inspection templates now persist to `collection-*.json` files. Existing operational files cover prestarts/defects, EWD/PINs, services, incidents, compliance attachments, health history, GPS shares, module selections and geofence alerts. One worker owns each company's writes; different companies cannot read each other's opaque record IDs. Record IDs can coincide across company directories without sharing records.

The pool defaults to four workers (`SV365_MAX_TENANT_WORKERS`). An idle workspace without enabled geofence monitoring can be evicted and reloaded from its files. Workspaces with active requests or enabled geofence rules are not evicted. If every worker is busy/protected, another workspace receives a retryable 503 instead of borrowing an existing company's process. Increase capacity only after checking hosting memory. This file-backed implementation is for **one application instance**; it must not be horizontally replicated against a shared disk. A transactional database is the next persistence/scaling upgrade, not a prerequisite for the implemented single-instance company boundary.

## Existing data and deployment

The gateway never assigns untagged legacy records to the first company signing up. Root-level legacy files are neither read by client workers nor deleted. Existing operational records remain quarantined until the owner confirms the destination company account.

Before the first production switch:

1. Confirm the Render workspace/service and inspect its persistent disk and `SV365_DATA_DIR`. The observed legacy path was `/opt/render/project/src/data/operations.json`; the existence of a persistent mount there has not yet been verified.
2. Back up the live account store and all operational data. Export in-memory assets/templates where necessary before stopping the old process. The old prototype did not persist every in-memory collection.
3. Confirm the destination company ID for legacy records. Never infer ownership from registration order, an email domain or an unverified signup.
4. With the service stopped, run `node scripts/migrate-legacy-company.js --company-id CO-... --service-stopped` against the backed-up, persistent data directory. The script refuses a non-empty destination and keeps original files unchanged. It does not copy the global account/session file or invent missing in-memory records.
5. Deploy the complete commit, keep a single instance, verify `/healthz`, unauthenticated redirects/401s, and two actual company sessions.

All old anonymous operational links now require company login. Their record/token lookups occur only inside that authenticated company. Cross-company guest sharing is intentionally not provided by this change.

## Verification

`npm run test:tenants` starts the actual gateway and workers with temporary fixture accounts, without sending email or contacting GPS providers. It covers anonymous and invalid-session access, forged company/header/query values, read/write separation for assets/employees/services/prestarts/defects/incidents/checklists/modules, GPS token separation, dashboard aggregates, document/export/share ID rejection, concurrent companies, worker restart and eviction, temporary-password gates, role-header spoofing, cross-origin mutations, logout and preservation of unassigned legacy files.

`npm run test:prestart` retains the existing prestart source checks.

Email verification, password recovery, per-role permissions throughout every operations module, managed database migration and deployment backups are separate remaining work. Company separation must not be described as those features being complete.
