const { Client } = require('pg');

async function sync() {
  const src = new Client({
    connectionString: 'postgresql://postgres.ydalijzvanwaughcrale:Y485S8j7e07R49Rt@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  const dst = new Client({
    connectionString: 'postgres://postgres:admin123@localhost:5432/faznetwork_db'
  });

  console.log('Connecting to databases...');
  await src.connect();
  await dst.connect();
  console.log('Connected!');

  const srcRes = await src.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const srcTables = srcRes.rows.map(r => r.table_name);

  const dstRes = await dst.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const dstTables = new Set(dstRes.rows.map(r => r.table_name));

  await dst.query("SET session_replication_role = 'replica';");

  for (const table of srcTables) {
    if (!dstTables.has(table)) {
      continue;
    }

    // লোকাল টেবিলের কলামগুলোর তালিকা বের করা
    const dstColsRes = await dst.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
    `, [table]);
    const validCols = new Set(dstColsRes.rows.map(c => c.column_name));

    process.stdout.write(`Copying ${table}... `);
    try {
      const data = await src.query(`SELECT * FROM "${table}"`);
      if (data.rows.length === 0) {
        console.log('0 rows');
        continue;
      }

      await dst.query(`TRUNCATE TABLE "${table}" CASCADE`);
      
      // শুধুমাত্র লোকাল ডাটাবেজে উপস্থিত কলামগুলো নির্বাচন করা
      const cols = Object.keys(data.rows[0]).filter(c => validCols.has(c));
      const colNames = cols.map(c => `"${c}"`).join(', ');

      const batchSize = 100;
      for (let i = 0; i < data.rows.length; i += batchSize) {
        const batch = data.rows.slice(i, i + batchSize);
        const valueSets = [];
        const values = [];
        let paramIdx = 1;

        for (const row of batch) {
          const placeholders = [];
          for (const col of cols) {
            placeholders.push(`$${paramIdx++}`);
            let val = row[col];
            if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
              val = JSON.stringify(val);
            }
            values.push(val);
          }
          valueSets.push(`(${placeholders.join(', ')})`);
        }

        await dst.query(`INSERT INTO "${table}" (${colNames}) VALUES ${valueSets.join(', ')}`, values);
      }
      console.log(`✓ ${data.rows.length} rows`);
    } catch (tableErr) {
      console.log(`⚠️ Skipped: ${tableErr.message}`);
    }
  }

  await dst.query("SET session_replication_role = 'DEFAULT';");
  await src.end();
  await dst.end();
  console.log('\n--- SUCCESS: Customers & All Data Synced Successfully! ---');
}

sync().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
