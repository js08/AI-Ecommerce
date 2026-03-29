// Imports the 'Pool' class from the 'pg' (PostgreSQL) library
const { Pool } = require('pg');

// Creates a new instance of the Pool with specific configuration settings
const pool = new Pool({
    // The address of the database server (uses environment variable or defaults to localhost)
    host: process.env.DB_HOST || 'localhost',

    // The username used to authenticate with the database
    user: 'admin',

    // The password for the specified user
    password: 'password',

    // The name of the specific database to connect to within the Postgres instance
    database: 'ecommerce',

    // The maximum number of concurrent client connections allowed in the pool
    max: 20,

    // How long a client can remain idle in the pool before being closed (30 seconds)
    idleTimeoutMillis: 30000
});

// Exports a helper object to be used by other parts of the application
module.exports = {
    // A helper function that takes a SQL string (text) and optional variables (params)
    // It executes the query using one of the available connections in the pool
    query: (text, params) => pool.query(text, params),
};