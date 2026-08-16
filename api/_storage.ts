import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

// 持久化存储层：
// - 生产（Vercel）：Upstash Redis（REST 接口，环境变量由 Vercel 集成自动注入）
// - 本地开发：data_storage/ 下的 JSON 文件，与旧行为完全一致
// 同一套 readJson/writeJson 接口，调用方无感知。

const KEY_PREFIX = 'zhihu-poster:';

// Vercel 的 Redis 集成注入的是 KV_* 变量名（旧版 Vercel KV），
// Upstash 直接集成则注入 UPSTASH_* —— 两者 REST 协议相同，均兼容。
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redisEnabled = !!(REDIS_URL && REDIS_TOKEN);

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    });
  }
  return redis;
}

const DATA_DIR = path.join(process.cwd(), 'data_storage');

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get<string | T>(KEY_PREFIX + name);
      if (raw !== null && raw !== undefined) {
        // @upstash/redis 客户端会自动把 JSON 字符串反序列化为对象，
        // 这里兼容两种形态：字符串则手动解析，对象则直接返回。
        return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
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

// ---- 原始字符串存储（用于图片 dataUrl 等非 JSON 大值） ----

// 文件名清洗：图片 key 形如 image:<templateId>:<optionId>，本地文件化时去掉冒号，
// 再追加 .raw 后缀与 JSON 文件区分。
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function readRaw(name: string, fallback: string | null = null): Promise<string | null> {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get<string>(KEY_PREFIX + name);
      if (typeof raw === 'string' && raw.length > 0) {
        return raw;
      }
    } catch (err) {
      console.error(`[storage] Redis 读取 ${name} 失败:`, err);
    }
    return fallback;
  }

  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    console.error(`[storage] 读取 ${name}.raw 失败:`, err);
  }
  return fallback;
}

export async function writeRaw(name: string, value: string): Promise<void> {
  if (redisEnabled) {
    try {
      await getRedis().set(KEY_PREFIX + name, value);
    } catch (err) {
      console.error(`[storage] Redis 写入 ${name} 失败:`, err);
    }
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${sanitize(name)}.raw`), value, 'utf-8');
  } catch (err) {
    console.error(`[storage] 写入 ${name}.raw 失败:`, err);
  }
}

export async function deleteRaw(name: string): Promise<void> {
  if (redisEnabled) {
    try {
      await getRedis().del(KEY_PREFIX + name);
    } catch (err) {
      console.error(`[storage] Redis 删除 ${name} 失败:`, err);
    }
    return;
  }

  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[storage] 删除 ${name}.raw 失败:`, err);
  }
}

export async function mgetRaw(names: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  if (names.length === 0) {
    return result;
  }

  if (redisEnabled) {
    try {
      const values = (await getRedis().mget(...names.map((n) => KEY_PREFIX + n))) as (string | null)[];
      names.forEach((n, i) => {
        const v = values[i];
        result[n] = typeof v === 'string' ? v : null;
      });
    } catch (err) {
      console.error('[storage] Redis mget 失败:', err);
      names.forEach((n) => { result[n] = null; });
    }
    return result;
  }

  for (const n of names) {
    result[n] = await readRaw(n);
  }
  return result;
}
