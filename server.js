const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mark Supervisor</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f6f8;
            margin: 0;
          }

          header {
            background: #111827;
            color: white;
            padding: 22px 40px;
          }

          main {
            padding: 40px;
          }

          .card {
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 800px;
            box-shadow: 0 2px 10px rgba(0,0,0,.08);
          }

          h1 {
            margin: 0;
          }

          .status {
            color: #15803d;
            font-weight: bold;
          }
        </style>
      </head>

      <body>

        <header>
          <h1>MARK SUPERVISOR</h1>
        </header>

        <main>
          <div class="card">
            <h2>Operations Dashboard</h2>

            <p class="status">
              ✓ Mark Supervisor is running
            </p>

            <p>
              Fleet and operations management platform.
            </p>

            <hr>

            <h3>Coming next</h3>

            <p>Fleet Management</p>
            <p>Vehicle Defects</p>
            <p>Pre-Start Inspections</p>
            <p>Maintenance</p>
            <p>Employees</p>
            <p>Compliance</p>

          </div>
        </main>

      </body>
    </html>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mark Supervisor running on port ${PORT}`);
});
