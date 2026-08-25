// Stable hosting entry point for Supervisor365.
// Install the smart navigation fix first so it can validate the injected menu HTML.
require('./src/smart-nav-fix');
// Install the smart grouped navigation before the app mounts its routes.
require('./src/smart-nav-patch');
// All pages are now mounted from isolated route modules under src/routes.
require('./app-master.js');
