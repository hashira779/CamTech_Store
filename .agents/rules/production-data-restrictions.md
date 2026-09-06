# Production Data Restrictions & Environment Boundary Rule

## Mandatory Restriction: NO AUTOMATED DATA SEEDING ON PRODUCTION

1. **Production Database Write Boundary:**
   * AI agents, automated tasks, and test scripts are **STRICTLY FORBIDDEN** from automatically inserting mock data, dummy transactions, fake customers, test orders, or auto-generated seed records into the remote production environment (`10.1.0.11`, `https://adminconsol.camtech.cam`, or `mystore-postgres` in production).
   * Production is reserved strictly for real enterprise operations and genuine customer/admin usage.

2. **Allowed Automated Data Scope:**
   * Automated seeding, mock generation, stress-test generation, or synthetic data insertion is **ONLY** permitted to run **locally on the user's PC** (`localhost:5432`, `camtechStore` dev DB on local machine).
   * Any script that generates mock/fake data MUST verify that `DATABASE_URL` or target host is `localhost` or `127.0.0.1`. If pointing to remote production (`10.1.0.11`), the script MUST abort immediately with an error.

3. **Permitted Remote Production Actions:**
   * Remote production access is strictly limited to:
     - DDL schema migrations (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, backward-compatible migrations).
     - System health checks, diagnostics, and structured log inspection.
     - Container lifecycle management (restarts, configuration deploys).
     - Data cleanup/restoration explicitly and directly requested by the user.

4. **Violations:**
   * Violating this rule pollutes business reporting, corrupts inventory balance, and triggers unneeded customer/order alerts in production. This restriction takes permanent precedence across all sessions.
