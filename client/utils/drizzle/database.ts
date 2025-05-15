import { drizzle } from "drizzle-orm/postgres-js";

const db_user = process.env.DB_USER
const db_password = process.env.DB_PASSWORD
const db_name = process.env.DB_NAME
const db_port = process.env.DB_PORT
const db_host = process.env.DB_HOST

export const db_url = `postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}`

export const db = drizzle(db_url);