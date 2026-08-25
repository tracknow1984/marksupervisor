// Stable hosting entry point for Supervisor365.
// During the build stage, restore a linked sample dataset whenever a fresh runtime starts.
require('./src/build-sample-data').seed();
// Install the smart navigation fix first so it can validate the injected menu HTML.
require('./src/smart-nav-fix');
// Install the smart grouped navigation before the app mounts its routes.
require('./src/smart-nav-patch');
// Add Reports into the Fleet section of the smart navigation.
require('./src/reports-nav-patch');
// Add user guidance for the asset expiry traffic-light status.
require('./src/asset-expiry-legend-patch');
// Add traffic-light expiry health indicators to the Assets register.
require('./src/asset-expiry-patch');
// Prevent expired registrations from being selected for pre-start inspections.
require('./src/prestart-registration-safety-patch');
// Re-link clearly matching Wialon units after the token is re-entered.
require('./src/gps-auto-link-patch');
// Add historical Wialon route playback controls to the existing Live GPS map.
require('./src/gps-playback-patch');
// Normalise Wialon report result formats and retrieve report rows before the main Reports wrapper.
require('./src/wialon-report-rows-fix');
// Bring Wialon report templates and report execution into Supervisor365.
require('./src/wialon-reports-patch');
// All pages are now mounted from isolated route modules under src/routes.
require('./app-master.js');
