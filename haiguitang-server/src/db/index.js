const { createPool } = require('mysql2/promise');

let pool;

const getDbPool = () => {
  if (!pool) {
    pool = createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'haiguitang',
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
    });
  }

  return pool;
};

const testConnection = async () => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT 1 AS ok');
  return rows && rows[0] && rows[0].ok === 1;
};

module.exports = {
  getDbPool,
  testConnection,
};

