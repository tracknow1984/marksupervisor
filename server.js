// Apply one day/month/year presentation policy to every HTML page.
require('./src/date-format-patch');
// Public entry point: authenticate before routing to a company-isolated worker.
require('./src/tenant-gateway').start();
