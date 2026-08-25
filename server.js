// Stable hosting entry point for Supervisor365.
// Install the smart navigation fix first so it can validate the injected menu HTML.
require('./src/smart-nav-fix');
// Install the smart grouped navigation before the app mounts its routes.
require('./src/smart-nav-patch');
// Add user guidance for the asset expiry traffic-light status.
require('./src/asset-expiry-legend-patch');
// Add traffic-light expiry health indicators to the Assets register.
require('./src/asset-expiry-patch');
// Prevent expired registrations from being selected for pre-start inspections.
require('./src/prestart-registration-safety-patch');
// All pages are now mounted from isolated route modules under src/routes.
require('./app-master.js');