import { createApp } from '../server/app';

// Vercel Serverless 函数入口：所有 /api/* 请求经 vercel.json 的 rewrite 转发到这里。
const appPromise = createApp();

export default function handler(req: any, res: any) {
  return appPromise.then((app) => app(req, res));
}
