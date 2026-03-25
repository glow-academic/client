---
name: creds
description: Database credentials for connecting to the local PostgreSQL database. Use when asked about database connection details or credentials.
---

# Database Credentials

Use these credentials to connect to the local PostgreSQL database via `psql`:

```bash
DB_USER="myuser"
DB_PASSWORD="mypassword"
DB_NAME="mydb"
DB_PORT="5432"
DB_HOST="localhost"
```

**Connection string:**
```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

**Note:** These are the default credentials used by the Makefile and docker-compose setup.
