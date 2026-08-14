// 一次性脚本：把本地 data_storage/*.json 导入 Upstash Redis（Vercel 生产存储）
// 用法（在项目根目录）：
//   vercel env pull --environment=production
//   node scripts/seed-kv.mjs
import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const PREFIX = 'zhihu-poster:';
const NAMES = ['admins', 'diy_templates', 'builtin_overrides', 'template_order'];

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error('缺少 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 环境变量');
  console.error('请先执行 vercel env pull --environment=production');
  process.exit(1);
}

const redis = new Redis({ url, token });

for (const name of NAMES) {
  const file = path.join(process.cwd(), 'data_storage', `${name}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`跳过 ${name}（本地无此文件）`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf-8');
  await redis.set(PREFIX + name, content);
  console.log(`✓ ${name} 已导入 (${content.length} 字节)`);
}
console.log('种子数据导入完成');
