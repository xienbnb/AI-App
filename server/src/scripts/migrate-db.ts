import { Client } from "pg";
import * as fs from "fs";

const NEW_DB = "postgresql://postgres:Cir25kpUUWKHzx72@db.hearaxqfxlngilbjvqtt.supabase.co:5432/postgres";

async function main() {
  const client = new Client({ connectionString: NEW_DB });
  await client.connect();
  console.log("✅ 连接成功!");

  // 读取 SQL 文件
  const sql = fs.readFileSync("/tmp/database-full-export.sql", "utf-8");
  
  // 按语句分割并执行
  const statements = sql.split(";\n").filter(s => s.trim().length > 0);
  let success = 0, failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    
    // 跳过注释行
    if (stmt.startsWith("--") || stmt.startsWith("/*")) {
      success++;
      continue;
    }
    
    try {
      await client.query(stmt);
      success++;
      if (i % 50 === 0) {
        const pct = ((i / statements.length) * 100).toFixed(0);
        process.stdout.write(`\r  进度: ${i}/${statements.length} (${pct}%)`);
      }
    } catch (err: any) {
      // 忽略 "already exists" 错误
      if (err.message?.includes("already exists")) {
        success++;
      } else {
        console.log(`\n❌ 语句 ${i} 失败: ${err.message?.slice(0, 100)}`);
        console.log(`   ${stmt.slice(0, 80)}...`);
        failed++;
      }
    }
  }
  
  console.log(`\n\n✅ 完成! 成功: ${success}, 失败: ${failed}`);
  
  // 验证
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(`\n📊 表数量: ${tables.rows.length}`);
  tables.rows.forEach((t: any) => console.log(`   - ${t.table_name}`));
  
  const users = await client.query("SELECT COUNT(*) FROM users");
  console.log(`\n👤 用户数: ${users.rows[0].count}`);
  
  await client.end();
}

main().catch(err => {
  console.error("❌ 连接失败:", err.message);
  process.exit(1);
});