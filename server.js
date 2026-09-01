// Stable hosting entry point for Supervisor365.
// During the build stage, restore a linked sample dataset whenever a fresh runtime starts.
require('./src/build-sample-data').seed();
// Mount public company registration, authentication, 2FA and employee onboarding.
require('./src/company-onboarding-patch');
// Standardise row/list action controls as icon-only actions across the site.
require('./src/global-action-icons-patch');
// Force Compliance register actions to use dedicated icons.
require('./src/compliance-action-icons-patch');
// Install the smart navigation fix first so it can validate the injected menu HTML.
require('./src/smart-nav-fix');
// Make EWD a first-class Operations item in the generated smart navigation.
require('./src/ewd-nav-core-fix');
// Make Geofence Alerts a first-class Fleet item in the generated smart navigation.
require('./src/geofence-nav-core-fix');
// Monitor GPS geofence departures against Passed pre-starts and surface critical system alerts.
// This loads before smart-nav so its UI wrapper receives the completed smart navigation HTML.
require('./src/geofence-prestart-alert-patch');
// Install the smart grouped navigation before the app mounts its routes.
require('./src/smart-nav-patch');
// Add Reports into the Fleet section of the smart navigation.
require('./src/reports-nav-patch');
// Mount the graphical owner/operations dashboard and make it the home page.
require('./src/dashboard-patch');
// Make the platform modular and expose the persistent internal Modules Store.
require('./src/module-nav-patch');
// Apply EWD resume/location/export safeguards before mounting the EWD router.
require('./src/ewd-critical-fix-patch');
// Use one backend path for Employee PIN save/self-test and EWD start authentication.
require('./src/ewd-unified-auth-patch');
// Manage permanent driver EWD PINs from Employee profiles.
require('./src/employee-ewd-pin-patch');
// Display employee licence expiry dates in Australian day/month/year format.
require('./src/employee-date-format-patch');
// Make Employee email and phone fields directly actionable for email/SMS follow-up.
require('./src/employee-contact-links-patch');
// Require the employee-configured EWD PIN when a diary starts.
require('./src/ewd-pin-auth-fix');
// Mount the candidate Electronic Work Diary driver/compliance workflow.
require('./src/ewd-patch');
// Make Passed pre-starts hand directly into the driver EWD workflow.
require('./src/ewd-prestart-handoff-patch');
// Deep-link Dashboard attention items to the exact record that needs resolution.
require('./src/dashboard-action-links-patch');
// Make only the dashboard KPI strip compact and futuristic.
require('./src/dashboard-kpi-future-patch');
// Add live operational intelligence, risk scoring and Ask S365 to the Dashboard.
require('./src/dashboard-intelligence-patch');
// Slightly increase Dashboard typography for easier reading while preserving the compact layout.
require('./src/dashboard-typography-patch');
// Match Service Schedule width to full-width pages such as Compliance.
require('./src/service-width-patch');
// Make the Assets summary cards futuristic and link them directly to their issues.
require('./src/assets-summary-future-patch');
// Add user guidance for the asset expiry traffic-light status.
require('./src/asset-expiry-legend-patch');
// Add traffic-light expiry health indicators to the Assets register.
require('./src/asset-expiry-patch');
// Prevent expired registrations from being selected for pre-start inspections.
require('./src/prestart-registration-safety-patch');
// Provide the Wialon odometer backend used directly by the source-level Pre-Start workflow.
require('./src/prestart-wialon-odometer-patch');
// Re-link clearly matching Wialon units after the token is re-entered.
require('./src/gps-auto-link-patch');
// Keep GPS linking one-to-one and remove already-linked assets/units from availability.
require('./src/gps-link-availability-patch');
// Add historical Wialon route playback controls to the existing Live GPS map.
require('./src/gps-playback-patch');
// Normalise Wialon report result formats and retrieve report rows before the main Reports wrapper.
require('./src/wialon-report-rows-fix');
// Bring Wialon report templates and report execution into Supervisor365.
require('./src/wialon-reports-patch');
// All pages are now mounted from isolated route modules under src/routes.
require('./app-master.js');