import 'dotenv/config';
import mysql from 'mysql2/promise';

async function testDatabaseConnection() {
  console.log('--------------------------------------------------');
  console.log('🔍 CA BUDDY DATABASE CONNECTION VERIFICATION TOOL');
  console.log('--------------------------------------------------');
  console.log(`📡 DB_HOST:     ${process.env.DB_HOST || 'localhost'}`);
  console.log(`🔌 DB_PORT:     ${process.env.DB_PORT || 3306}`);
  console.log(`👤 DB_USER:     ${process.env.DB_USER || '(none)'}`);
  console.log(`🗄️  DB_NAME:     ${process.env.DB_NAME || '(none)'}`);
  console.log('--------------------------------------------------');

  try {
    const conn = await mysql.createConnection({
      host: (process.env.DB_HOST || 'localhost').trim(),
      port: Number(process.env.DB_PORT || 3306),
      user: (process.env.DB_USER || '').trim(),
      password: (process.env.DB_PASSWORD || '').trim(),
      database: (process.env.DB_NAME || '').trim(),
      connectTimeout: 5000
    });

    console.log('✅ STATUS: CONNECTED SUCCESSFULLY TO MYSQL DATABASE!');
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log(`📊 Found ${tableNames.length} tables:`, tableNames.join(', '));
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.log('❌ STATUS: COULD NOT CONNECT TO MYSQL DATABASE');
    console.log(`⚠️  Error Code:    ${err.code}`);
    console.log(`⚠️  Error Message: ${err.message}`);
    console.log('--------------------------------------------------');
    if (err.code === 'ETIMEDOUT') {
      console.log('💡 CAUSE: StackCP firewall is blocking external MacBook IP.');
      console.log('💡 FIX: Enable "Remote MySQL" in StackCP Control Panel.');
    } else if (err.code === 'ENOTFOUND') {
      console.log('💡 CAUSE: Domain name not found.');
      console.log('💡 FIX: Use mysql.gb.stackcp.com for external access or sdb-88.hosting.stackcp.net for live host.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 CAUSE: Invalid DB_USER or DB_PASSWORD.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 CAUSE: Database does not exist yet. Run schema.sql in phpMyAdmin.');
    }
    process.exit(1);
  }
}

testDatabaseConnection();
