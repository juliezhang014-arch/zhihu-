import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

// 持久化存储层：
// - 生产（Vercel）：Upstash Redis（REST 接口，环境变量由 Vercel 集成自动注入）
// - 本地开发：data_storage/ 下的 JSON 文件，与旧行为完全一致
// 同一套 readJson/writeJson 接口，调用方无感知。

const KEY_PREFIX = 'zhihu-poster:';

const redisEnabled = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

const DATA_DIR = path.join(process.cwd(), 'data_storage');

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get<string>(KEY_PREFIX + name);
      if (raw !== null && raw !== undefined) {
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.error(`[storage] Redis 读取 ${name} 失败:`, err);
    }
    return fallback;
  }

  try {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch (err) {
    console.error(`[storage] 读取 ${name}.json 失败:`, err);
  }
  return fallback;
}

export async function writeJson<T>(name: string, data: T): Promise<void> {
  if (redisEnabled) {
    try {
      await getRedis().set(KEY_PREFIX + name, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`[storage] Redis 写入 ${name} 失败:`, err);
    }
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[storage] 写入 ${name}.json 失败:`, err);
  }
}
