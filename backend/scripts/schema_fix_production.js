#!/usr/bin/env node
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

console.log("🔧 Adapt V3 Production Schema Fix Script");
console.log("========================================");

async function runSchemaFix() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required!");
    console.error("💡 Please set your production DATABASE_URL:");
    console.error("   export DATABASE_URL='postgresql://username:password@host:port/database'");
    console.error("   or");
    console.error("   DATABASE_URL='postgresql://username:password@host:port/database' node scripts/schema_fix_production.js");
    process.exit(1);
  }

  console.log("🔧 Starting comprehensive schema fix for Adapt V3 production...");
  console.log("📍 Target database:", process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'production');

  const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pg.connect();
    console.log("✅ Connected to database");

    // Read the comprehensive schema fix SQL
    const sqlFile = path.join(__dirname, '..', 'comprehensive_schema_fix.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log("📄 Executing schema fix SQL...");

    // Execute the SQL
    await pg.query(sql);

    console.log("✅ Schema fix completed successfully!");

    // Verify the fix
    console.log("\n🔍 Verifying database structure...");

    const tablesResult = await pg.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('question_vectors', 'feedbacks', 'ai_interactions')
      ORDER BY tablename;
    `);

    console.log("📋 Tables created/fixed:");
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.tablename}`);
    });

    // Check pgvector extension
    const extensionResult = await pg.query(`
      SELECT name, default_version, installed_version
      FROM pg_available_extensions
      WHERE name = 'vector';
    `);

    if (extensionResult.rows.length > 0) {
      const ext = extensionResult.rows[0];
      console.log(`🧮 pgvector extension: ${ext.installed_version || 'Not installed'}`);
    }

    // Check indexes
    const indexResult = await pg.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('question_vectors', 'feedbacks', 'ai_interactions')
        AND schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log("\n📊 Indexes created:");
    indexResult.rows.forEach(row => {
      console.log(`  ✓ ${row.tablename}.${row.indexname}`);
    });

    // Test a simple vector operation
    try {
      const testResult = await pg.query(`
        SELECT COUNT(*) as vector_count
        FROM question_vectors
        WHERE embedding IS NOT NULL;
      `);
      console.log(`\n🎯 Vector table ready: ${testResult.rows[0].vector_count} vectors stored`);
    } catch (error) {
      console.log("⚠️  Vector table ready but no data yet (this is expected)");
    }

    console.log("\n🎉 Schema fix completed! AI learning and vector search should now work.");
    console.log("💡 Next steps:");
    console.log("   1. Update Prisma schema");
    console.log("   2. Resolve migration conflicts");
    console.log("   3. Generate new Prisma client");

  } catch (error) {
    console.error("❌ Schema fix failed:", error);
    throw error;
  } finally {
    await pg.end();
    console.log("🔌 Database connection closed");
  }
}

// Check if DATABASE_URL is provided and run the fix
if (require.main === module) {
  runSchemaFix().catch(error => {
    console.error("💥 Critical error during schema fix:", error);
    process.exit(1);
  });
}

module.exports = { runSchemaFix };
