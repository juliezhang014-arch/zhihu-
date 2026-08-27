// api/_app.ts
import crypto from "crypto";
import zlib from "zlib";
import express from "express";

// api/_templates.ts
var BUILTIN_TEMPLATES = [
  {
    id: "folk-reviewer",
    name: "\u6C11\u95F4\u9510\u8BC4\u4EBA\xB7\u8BF7\u5C31\u4F4D",
    category: "\u70ED\u95E8\u6A21\u7248",
    description: "\u77E5\u4E4E\u98CE\u683C\u6C11\u95F4\u9510\u8BC4\u5361\u7247\uFF08\u5305\u542B\u592F\u3001\u9876\u7EA7\u3001\u4EBA\u4E0A\u4EBA\u3001NPC\u3001\u62C9\u5B8C\u4E86\u5206\u7EA7\uFF09",
    aspectRatio: 0.75,
    // 1125:1500 portrait poster
    width: 1125,
    height: 1500,
    bgType: "image",
    bgImageUrl: "https://picx.zhimg.com/v2-01d4b4d0a7a64017638b4f6936e243b0.png",
    defaultFontId: "zcool-kuaile",
    defaultColor: "#1e293b",
    isBuiltin: true,
    isPublished: true,
    slots: [
      {
        id: "slot-1",
        label: "\u592F",
        placeholder: "\u4F8B\u5982\uFF1A\u6708\u85AA\u4E09\u5343\uFF0C\u82B1\u4E24\u5343\u4E94\u79DF\u623F\uFF0C\u5269\u4E0B\u4E94\u767E\u7559\u7ED9\u53D1\u4E1D\u6297\u4E89",
        value: "",
        x: 28.44,
        y: 40.5,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#ef4444",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-2",
        label: "\u9876\u7EA7",
        placeholder: "\u4F8B\u5982\uFF1A\u628A\u751F\u6D3B\u8FC7\u6210\u7701\u94B1\u6E38\u620F\uFF0C\u5168\u7F51\u641C\u5238\u53EA\u4E3A\u4F18\u60E0\u4E24\u5757\u94B1",
        value: "",
        x: 28.44,
        y: 49.17,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#f97316",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-3",
        label: "\u4EBA\u4E0A\u4EBA",
        placeholder: "\u4F8B\u5982\uFF1A\u4E0B\u73ED\u81EA\u7531\u5206\u914D\u65F6\u95F4\uFF0C\u5076\u5C14\u4E70\u675F\u9C9C\u82B1\u5956\u52B1\u81EA\u5DF1",
        value: "",
        x: 28.44,
        y: 58.07,
        width: 55.11,
        height: 5.87,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#eab308",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-4",
        label: "NPC",
        placeholder: "\u4F8B\u5982\uFF1A\u65E9\u516B\u665A\u516D\u6309\u65F6\u4E0A\u73ED\uFF0C\u65E2\u4E0D\u4E0A\u8FDB\u4E5F\u4E0D\u6446\u70C2",
        value: "",
        x: 28.44,
        y: 67,
        width: 55.11,
        height: 5.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#facc15",
        tagTextColor: "#1e293b",
        locked: true
      },
      {
        id: "slot-5",
        label: "\u62C9\u5B8C\u4E86",
        placeholder: "\u4F8B\u5982\uFF1A\u4EE3\u7801\u8DD1\u5D29\u9879\u76EE\u5EF6\u671F\uFF0C\u5496\u5561\u52A0\u6D53\u4E5F\u6551\u4E0D\u4E86\u9ED1\u773C\u5708",
        value: "",
        x: 28.44,
        y: 75.5,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#38bdf8",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-reviewer",
        label: "\u9510\u8BC4\u4EBA\uFF1A@",
        placeholder: "\u6DF1\u591C\u6253\u5DE5\u4EBA\u963F\u5F3A",
        value: "",
        x: 48.89,
        y: 84,
        width: 22.22,
        height: 2.67,
        align: "left",
        fontSize: 24,
        color: "#fdd937",
        tagBgColor: "#2563eb",
        tagTextColor: "#ffffff",
        fontWeight: "bold",
        locked: true
      }
    ]
  }
];

// api/_storage.ts
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
var KEY_PREFIX = "zhihu-poster:";
var REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
var redisEnabled = !!(REDIS_URL && REDIS_TOKEN);
var redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN
    });
  }
  return redis;
}
var DATA_DIR = path.join(process.cwd(), "data_storage");
async function readJson(name, fallback) {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get(KEY_PREFIX + name);
      if (raw !== null && raw !== void 0) {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (err) {
      console.error(`[storage] Redis \u8BFB\u53D6 ${name} \u5931\u8D25:`, err);
    }
    return fallback;
  }
  try {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.error(`[storage] \u8BFB\u53D6 ${name}.json \u5931\u8D25:`, err);
  }
  return fallback;
}
async function writeJson(name, data) {
  if (redisEnabled) {
    await getRedis().set(KEY_PREFIX + name, JSON.stringify(data, null, 2));
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] \u5199\u5165 ${name}.json \u5931\u8D25:`, err);
  }
}
function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
async function readRaw(name, fallback = null) {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get(KEY_PREFIX + name);
      if (typeof raw === "string" && raw.length > 0) {
        return raw;
      }
    } catch (err) {
      console.error(`[storage] Redis \u8BFB\u53D6 ${name} \u5931\u8D25:`, err);
    }
    return fallback;
  }
  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (err) {
    console.error(`[storage] \u8BFB\u53D6 ${name}.raw \u5931\u8D25:`, err);
  }
  return fallback;
}
async function writeRaw(name, value) {
  if (redisEnabled) {
    await getRedis().set(KEY_PREFIX + name, value);
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${sanitize(name)}.raw`), value, "utf-8");
  } catch (err) {
    console.error(`[storage] \u5199\u5165 ${name}.raw \u5931\u8D25:`, err);
  }
}
async function deleteRaw(name) {
  if (redisEnabled) {
    try {
      await getRedis().del(KEY_PREFIX + name);
    } catch (err) {
      console.error(`[storage] Redis \u5220\u9664 ${name} \u5931\u8D25:`, err);
    }
    return;
  }
  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[storage] \u5220\u9664 ${name}.raw \u5931\u8D25:`, err);
  }
}
async function mgetRaw(names) {
  const result = {};
  if (names.length === 0) {
    return result;
  }
  if (redisEnabled) {
    try {
      const values = await getRedis().mget(...names.map((n) => KEY_PREFIX + n));
      names.forEach((n, i) => {
        const v = values[i];
        result[n] = typeof v === "string" ? v : null;
      });
    } catch (err) {
      console.error("[storage] Redis mget \u5931\u8D25:", err);
      names.forEach((n) => {
        result[n] = null;
      });
    }
    return result;
  }
  for (const n of names) {
    result[n] = await readRaw(n);
  }
  return result;
}

// api/_sensitiveWords.ts
var POLITICAL_WORDS = [
  "9ping",
  "9\u8BC4",
  "adrenaline",
  "androst",
  "benzodiazepines",
  "cannabis",
  "cocain",
  "communistparty",
  "dajiyuan",
  "diacetylmorphine",
  "diamorphine",
  "erythropoietin",
  "falungong",
  "fa\u8F6E",
  "flg",
  "fl\u529F",
  "gcd",
  "gc\u515A",
  "gongchandang",
  "gong\u515A",
  "gong\u548C",
  "g\u4EA7",
  "g\u532A",
  "heroin",
  "hjt",
  "hujintao",
  "jiuping",
  "jzm",
  "ketamine",
  "k\u7C89",
  "mdma",
  "strychnine",
  "suicide",
  "tamoxifen",
  "testosterone",
  "titor",
  "tuidang",
  "xiao\u5E73",
  "xjp",
  "zedong",
  "zemin",
  "ze\u4E1C",
  "ze\u6C11",
  "zhengfu",
  "zi\u6740",
  "z\u4E1C",
  "\u4E01\u4E00\u5E73",
  "\u4E01\u946B\u53D1",
  "\u4E09\u53BB\u8F66\u4ED1",
  "\u4E09\u5511\u4ED1",
  "\u4E18\u5E7F\u949F",
  "\u4E1B\u798F\u594E",
  "\u4E25\u91CD\u8FDD\u7EAA",
  "\u4E2Dgong",
  "\u4E2D\u5171",
  "\u4E2D\u534E\u5E1D\u56FD",
  "\u4E2D\u5357\u6D77",
  "\u4E2D\u56FDzf",
  "\u4E2D\u56FD\u5F53\u5C40",
  "\u4E2D\u56FD\u6559\u5F92",
  "\u4E2D\u592Ezf",
  "\u4E2D\u592E\u9886\u5BFC",
  "\u4E2D\u73D9",
  "\u4E3B\u5E2D\u753B\u50CF",
  "\u4E5Dping",
  "\u4E5D\u8BC4",
  "\u4E60\u4EF2\u52CB",
  "\u4E60\u592A\u5B50",
  "\u4E60\u660E\u6CFD",
  "\u4E60\u8FD1\u5E73",
  "\u4E70\u522B\u5885",
  "\u4E8E\u5E7C\u519B",
  "\u4E8E\u98DE \u5E7F\u4E1C",
  "\u4E9A\u7837\u9178\u94A0",
  "\u4E9A\u7837\u9178\u94BE",
  "\u4E9A\u7837\uFF08\u9178\uFF09\u9150",
  "\u4E9A\u7852\u9178",
  "\u4E9A\u7852\u9178\u4E8C\u94A0",
  "\u4E9A\u7852\u9178\u6C22\u94A0",
  "\u4E9A\u7852\u9178\u94A0",
  "\u4E9A\u7852\u9178\u9541",
  "\u4E9A\u785D\u9170\u4E59\u6C27",
  "\u4E9A\u785D\u9178\u4E59\u916F",
  "\u4EA7\u515A\u5171",
  "\u4EBA\u7C7B\u706D\u4EA1\u8FDB\u7A0B\u8868",
  "\u4EC7\u5171",
  "\u4ED8\u6653\u5149",
  "\u4EE3\u8840\u6D46",
  "\u4EE4\u8BA1\u5212",
  "\u4EE5\u6743\u8C0B\u79C1",
  "\u4F2A\u706B",
  "\u4F55\u6D2A\u8FBE",
  "\u4F9B\u4EA7",
  "\u4F9B\u94F2\u515A",
  "\u4F9B\u94F2\u88C6",
  "\u4F9B\u94F2\u8C20",
  "\u4FAF\u4F0D\u6770",
  "\u4FC3\u6027\u817A\u6FC0\u7D20",
  "\u4FC3\u7EA2\u7EC6\u80DE\u751F\u6210\u7D20",
  "\u4FDE\u6B63\u58F0",
  "\u502A\u732E\u7B56",
  "\u5085\u9510",
  "\u515A\u4EA7\u5171",
  "\u516C\u4EA7\u515A",
  "\u5171c\u515A",
  "\u5171x\u515A",
  "\u5171\u4E00\u4EA7\u4E00\u515A",
  "\u5171\u4EA7\u4E13\u5236",
  "\u5171\u4EA7\u4E3B\u4E49\u7684\u5E7D\u7075",
  "\u5171\u4EA7\u515A",
  "\u5171\u4EA7\u515A\u4E13\u5236",
  "\u5171\u4EA7\u515A\u7684\u62A5\u5E94",
  "\u5171\u4EA7\u515A\u7684\u672B\u65E5",
  "\u5171\u4EA7\u515A\u8150\u8D25",
  "\u5171\u4EA7\u738B\u671D",
  "\u5171\u532A",
  "\u5171\u60E8",
  "\u5171\u6B8B\u4E3B\u4E49",
  "\u5171\u6B8B\u515A",
  "\u5171\u6B8B\u88C6",
  "\u5171\u72D7",
  "\u5171\u8D2A\u515A",
  "\u5171\u94F2",
  "\u5174\u594B\u5242",
  "\u51B0\u6BD2",
  "\u51EF\u4ED6\u654F",
  "\u5218\u4E91\u5C71",
  "\u5218\u514B\u7530",
  "\u5218\u5947\u8446",
  "\u5218\u5C11\u5947",
  "\u5218\u5E7F\u667A \u7A7A\u519B",
  "\u5218\u5EF6\u4E1C",
  "\u5218\u5FD7\u519B",
  "\u5218\u5FD7\u534E",
  "\u5218\u65B9\u4EC1",
  "\u5218\u6C38\u6E05",
  "\u5218\u745E\u9F99",
  "\u5218\u77E5\u70B3",
  "\u5218\u7EF4\u660E",
  "\u5218\u8FDE\u6606",
  "\u5218\u91D1\u5B9D",
  "\u5218\u957F\u8D35",
  "\u5219\u6C11",
  "\u5224\u5904\u6B7B\u5211",
  "\u5265\u593A\u653F\u6CBB\u6743\u5229",
  "\u5265\u593A\u653F\u6CBB\u6743\u5229\u7EC8\u8EAB",
  "\u5317\u4EAC\u5F53\u5C40",
  "\u5317\u4EAC\u653F\u6743",
  "\u534E\u4E3B\u5E2D",
  "\u534E\u56FD",
  "\u534E\u5EFA\u654F",
  "\u5355\u5E73",
  "\u539F\u5B50\u5F39\u65B9\u6CD5",
  "\u539F\u5B50\u5F39\u6E05\u5355",
  "\u539F\u88C5\u5F39",
  "\u53CC\u5F00",
  "\u53CC\u89C4",
  "\u53D1\u8BBA\u5DE5",
  "\u53D7\u8D3F\u7F6A",
  "\u53DB\u9003\u7F8E\u56FD",
  "\u53F6\u5251\u82F1",
  "\u5415\u5FB7\u5F6C",
  "\u5415\u7956\u5584",
  "\u5417\u5561",
  "\u5434\u4EEA",
  "\u5434\u5B98\u6B63",
  "\u5434\u5B9A\u5BCC",
  "\u5434\u632F\u6C49",
  "\u5434\u6587\u82F1 \u7EBA\u7EC7",
  "\u5434\u80DC\u5229",
  "\u5434\u90A6\u56FD",
  "\u544B\u585E\u7C73",
  "\u5468\u5C0F\u5DDD",
  "\u5468\u5EFA\u5357",
  "\u5468\u6587\u5409",
  "\u5468\u6C38\u5EB7",
  "\u5468\u751F\u8D24",
  "\u5496\u5561\u56E0",
  "\u552E\u4E00\u5143\u786C",
  "\u552E\u4E09\u68F1",
  "\u552E\u4E94\u56DB",
  "\u552E\u5047\u5E01",
  "\u552E\u5065\u536B",
  "\u552E\u519B\u7528",
  "\u552E\u5355\u7BA1",
  "\u552E\u5B50\u5F39",
  "\u552E\u5DE6\u8F6E",
  "\u552E\u5F39\u7C27\u5200",
  "\u552E\u624B\u67AA",
  "\u552E\u67AA\u652F",
  "\u552E\u6B65\u67AA",
  "\u552E\u6C2F\u80FA",
  "\u552E\u706B\u836F",
  "\u552E\u70ED\u6B66",
  "\u552E\u72D7\u5B50",
  "\u552E\u730E\u67AA",
  "\u552E\u7EAF\u5EA6",
  "\u552E\u864E\u5934",
  "\u552E\u9632\u8EAB",
  "\u552E\u9EBB\u9189",
  "\u56DE\u826F\u7389",
  "\u56FDwu\u9662",
  "\u56FD\u5CF0",
  "\u56FD\u950B",
  "\u571Fg",
  "\u571F\u5171",
  "\u5730\u585E\u7C73\u677E",
  "\u5730\u5948\u5FB7",
  "\u5730\u897F\u6CEE",
  "\u5927\u6CD5\u5F1F\u5B50",
  "\u5927\u7EAA\u5143",
  "\u5927\u9646\u5B98\u65B9",
  "\u5927\u9646\u5F53\u5C40",
  "\u5927\u9EBB",
  "\u595A\u56FD\u534E",
  "\u59DA\u4F9D\u6797",
  "\u59DC\u6BBF\u6B66 \u6CB3\u5317",
  "\u59EC\u80DC\u5FB7 \u603B\u53C2",
  "\u5B59\u5584\u6B66\u6CB3\u5357",
  "\u5B59\u5BB6\u6B63",
  "\u5B59\u5C0F\u8679",
  "\u5B59\u664B\u7F8E",
  "\u5B59\u745C",
  "\u5B59\u9E64\u9F84",
  "\u5B5F\u5E86\u5E73",
  "\u5B5F\u5EFA\u67F1",
  "\u5B89\u7720\u916E",
  "\u5B89\u975E\u4ED6\u547D",
  "\u5B8B\u52C7\u8FBD\u5B81",
  "\u5B8B\u5E73\u987A",
  "\u5B8B\u6668\u5149\u6C5F\u897F",
  "\u5B98\u50DA\u4E3B\u4E49",
  "\u5C3C\u53EF\u5239\u7C73",
  "\u5C60\u5149\u7ECD",
  "\u5DE5\u4EA7\u515A",
  "\u5DE8\u989D\u8D22\u4EA7",
  "\u5E38\u4E07\u5168",
  "\u5E38\u5F81\u8D35\u5DDE",
  "\u5E73\u4E49\u6770",
  "\u5E73\u5C0F\u9093",
  "\u5E73\u8FD1\u4E60",
  "\u5EB7\u65E5\u65B0",
  "\u5ED6\u4F2F\u5E74 \u5317\u4EAC",
  "\u5ED6\u9521\u9F99",
  "\u5F00\u9664\u515A\u7C4D",
  "\u5F20\u51EF\u5E7F\u4E1C",
  "\u5F20\u56FD\u5149",
  "\u5F20\u57F9\u8389",
  "\u5F20\u5B97\u6D77",
  "\u5F20\u5B9A\u53D1",
  "\u5F20\u5BB6\u76DF\u6D59\u6C5F",
  "\u5F20\u5FB7\u6C5F",
  "\u5F20\u5FD7\u56FD",
  "\u5F20\u6069\u7167",
  "\u5F20\u6625\u6C5F",
  "\u5F20\u66D9",
  "\u5F20\u79CB\u9633",
  "\u5F20\u7ACB\u660C",
  "\u5F20\u8363\u5764",
  "\u5F20\u8F9B\u6CF0",
  "\u5F20\u9AD8\u4E3D",
  "\u5F3A\u536B",
  "\u5F87\u79C1\u821E\u5F0A",
  "\u5F90\u53D1 \u9ED1\u9F99\u6C5F",
  "\u5F90\u56FD\u5065",
  "\u5F90\u624D\u539A",
  "\u5F90\u660E",
  "\u5F90\u70B3\u677E",
  "\u5F90\u7ECD\u53F2",
  "\u5F90\u884D\u4E1C",
  "\u5F90\u9E4F\u822A",
  "\u5FD7\u6D2A\u674E",
  "\u6076\u515A",
  "\u6155\u7EE5\u65B0",
  "\u6210\u514B\u6770",
  "\u6234\u79C9\u56FD",
  "\u6258\u4E4E\u63D0\u6C99\u6BD4\u5C14",
  "\u62E9\u6C11",
  "\u62F1\u94F2",
  "\u6309\u7167\u9A6C\u96C5\u5386\u6CD5",
  "\u6321\u4E2D\u592E",
  "\u63A8bei\u56FE",
  "\u63A8\u80CC\u56FE",
  "\u64A4\u804C\u3002",
  "\u64A4\u9500\u804C\u52A1",
  "\u6536\u53D7\u80A1\u7968",
  "\u6539\u9769\u5386\u7A0B",
  "\u653Ff",
  "\u653Fzhi",
  "\u653F\u4ED8",
  "\u653F\u4FEF",
  "\u653F\u5E9C",
  "\u653F\u8150",
  "\u65B0\u5510\u4EBA",
  "\u65B0\u578B\u6BD2\u54C1",
  "\u65B0\u7586\u9A9A\u4E71",
  "\u65E0\u5B98\u6B63",
  "\u65E0\u671F\u5F92\u5211",
  "\u660E\u6167\u5468\u62A5",
  "\u660E\u6167\u7F51",
  "\u666E\u8418\u6D1B\u5C14",
  "\u66F9\u521A\u5DDD",
  "\u66FE\u57F9\u708E",
  "\u66FE\u5BAA\u6893",
  "\u66FE\u5E86\u7EA2",
  "\u66FE\u836B\u6743",
  "\u6709\u671F\u5F92\u5211",
  "\u6731\u4E91\u6765",
  "\u6731\u4F5C\u52C7\u7518\u8083",
  "\u6731\u5BB9\u57FA",
  "\u6731\u5BB9\u9E21",
  "\u6731\u5C0F\u534E\u5149\u5927",
  "\u6731\u5DDD",
  "\u6731\u5FD7\u521A",
  "\u6731\u6D77\u4ED1",
  "\u6731\u745F\u91CC\u8BFA",
  "\u6731\u9555\u57FA",
  "\u6731\u9555\u9E21",
  "\u674Epeng",
  "\u674E\u5148\u5FF5",
  "\u674E\u514B\u5F3A",
  "\u674E\u542F\u7EA2",
  "\u674E\u5609\u5EF7",
  "\u674E\u5802\u5802",
  "\u674E\u5927\u5F3A \u795E\u534E",
  "\u674E\u5B66\u4E3E",
  "\u674E\u5B8F\u5FD7",
  "\u674E\u5B9D\u91D1",
  "\u674E\u5C0F\u7433",
  "\u674E\u5C0F\u9E4F",
  "\u674E\u5C9A\u6E05",
  "\u674E\u5E72\u6210",
  "\u674E\u5EFA\u56FD",
  "\u674E\u5FB7\u751F",
  "\u674E\u6069\u6F6E",
  "\u674E\u6548\u65F6",
  "\u674E\u6625\u57CE",
  "\u674E\u6708\u6708\u9E1F",
  "\u674E\u6C9B\u7476",
  "\u674E\u6D2A\u5FD7",
  "\u674E\u6E90\u6F6E",
  "\u674E\u745E\u73AF",
  "\u674E\u7EAA\u5468",
  "\u674E\u8363\u878D",
  "\u674E\u8FBE\u660C",
  "\u674E\u94C1\u6620",
  "\u674E\u957F\u6625",
  "\u674E\u9E4F",
  "\u675C\u4E16\u6210",
  "\u675C\u51B7\u4E01",
  "\u675C\u5FB7\u5370",
  "\u6765\u6E90\u4E0D\u660E\u7F6A",
  "\u6768\u6C47\u6CC9",
  "\u6768\u6D01\u7BEA",
  "\u6797\u5B54\u5174",
  "\u6797\u5DE6\u9E23",
  "\u6797\u6811\u68EE",
  "\u6797\u708E\u5FD7",
  "\u67AA\u51B3\u5973\u72AF",
  "\u67AA\u51FA\u552E",
  "\u67AA\u5B50\u5F39",
  "\u67AA\u624B",
  "\u67AA\u68B0\u5236",
  "\u67AA\u6A21",
  "\u67AA\u7684\u5236",
  "\u67AA\u8D27\u5230",
  "\u67AA\u9500\u552E",
  "\u67E5\u514B\u660E \u534E\u80FD",
  "\u67F3\u658C\u6770",
  "\u67F4\u738B\u7FA4",
  "\u6817\u667A",
  "\u6839\u8FBE\u4E9A\u6587\u660E",
  "\u6863\u4E2D\u592E",
  "\u6881\u5149\u70C8",
  "\u6881\u6625\u7984\u5E7F\u897F\u653F\u534F",
  "\u6881\u6E58",
  "\u6B27\u5E7F\u6E90",
  "\u6B27\u9633\u5FB7 \u5E7F\u4E1C",
  "\u6B63\u5E9C",
  "\u6B63\u89C1\u7F51",
  "\u6B7B\u5211",
  "\u6B7B\u5211\u7F13\u671F",
  "\u6BB5\u4E49\u548C",
  "\u6BDBzd",
  "\u6BDBzx",
  "\u6BDB\u592A\u7956",
  "\u6BDB\u6CFD\u4E1C",
  "\u6BDB\u76F8",
  "\u6C11\u6CFD\u6C5F",
  "\u6C27\u5316\u4E8C\u4E01\u57FA\u9521",
  "\u6C27\u5316\u4E9A\u94CA",
  "\u6C27\u5316\u6C5E",
  "\u6C27\u5316\u94CA",
  "\u6C27\u6C2F\u5316\u78F7",
  "\u6C2F\u567B\u55EA",
  "\u6C2F\u80FA\u916E",
  "\u6C35\u53BB\u8F66\u4ED1",
  "\u6C5Fcore",
  "\u6C5Fx",
  "\u6C5Fzm",
  "\u6C5F\u4E3B\u5E2D",
  "\u6C5F\u4E66\u8BB0",
  "\u6C5F\u54E5",
  "\u6C5F\u620F\u5B50",
  "\u6C5F\u67D0\u67D0",
  "\u6C5F\u6C0F\u96C6\u56E2",
  "\u6C5F\u6CA2\u6C11",
  "\u6C5F\u6CFD\u6167",
  "\u6C5F\u6CFD\u6C11",
  "\u6C5F\u6D3E",
  "\u6C5F\u6D59\u6C11",
  "\u6C5F\u6D59\u95FD",
  "\u6C5F\u732A",
  "\u6C5F\u7EF5\u5EB7",
  "\u6C5F\u7EF5\u6052",
  "\u6C5F\u80E1",
  "\u6C5F\u86E4\u87C6",
  "\u6C5F\u8D3C",
  "\u6C6A\u4E1C\u5174",
  "\u6C88\u56FE",
  "\u6C88\u8DC3\u8DC3",
  "\u6CA1\u6536\u4E2A\u4EBA\u5168\u90E8\u8D22\u4EA7",
  "\u6CA1\u6536\u4E2A\u4EBA\u8D22\u4EA7",
  "\u6CD50\u529F",
  "\u6CD5lg",
  "\u6CD5lun",
  "\u6CD5o\u529F",
  "\u6CD5x\u529F",
  "\u6CD5\u4E00\u8F6E\u4E00\u529F",
  "\u6CD5\u8F6E",
  "\u6CD5\u8F6E\u529F",
  "\u6CFC\u5C3C\u677E",
  "\u6CFDd",
  "\u6D2A\u6E05\u6E90",
  "\u6D4E\u4E16\u7075\u6587",
  "\u6D77luo\u56E0",
  "\u6D77\u6D1B\u56E0",
  "\u6E05\u6D77\u65E0\u4E0A\u5E08",
  "\u6E29jb",
  "\u6E29jia\u5B9D",
  "\u6E29x",
  "\u6E29\u4E91\u677E",
  "\u6E29\u52A0\u4FDD",
  "\u6E29\u52A0\u5B9D",
  "\u6E29\u52A0\u9971",
  "\u6E29\u5982\u6625",
  "\u6E29\u5B9D\u5B9D",
  "\u6E29\u5BB6\u5B9D",
  "\u6E56\u7D27\u638F",
  "\u6EE5\u7528\u804C\u6743",
  "\u6F58\u5E7F\u7530\u5C71\u4E1C",
  "\u7231\u4ED6\u6B7B",
  "\u72D7\u4EA7\u86CB",
  "\u732B\u5219\u4E1C",
  "\u732B\u6CFD\u4E1C",
  "\u732B\u8D3C\u6D1E",
  "\u738B\u4E1C\u660E",
  "\u738B\u4E50\u6BC5",
  "\u738B\u4E50\u6CC9",
  "\u738B\u5146\u56FD",
  "\u738B\u51B6\u576A",
  "\u738B\u534E\u5143",
  "\u738B\u539A\u5B8F\u6D77\u5357",
  "\u738B\u592A\u534E",
  "\u738B\u5B66\u519B",
  "\u738B\u5B88\u4E1A",
  "\u738B\u5B9D\u68EE",
  "\u738B\u5C90\u5C71",
  "\u738B\u5E86\u5F55\u5E7F\u897F",
  "\u738B\u5F0F\u60E0\u91CD\u5E86",
  "\u738B\u6000\u5FE0",
  "\u738B\u632F\u534E",
  "\u738B\u662D\u8000",
  "\u738B\u6709\u6770\u6CB3\u5357",
  "\u738B\u6B66\u9F99\u6C5F\u82CF",
  "\u738B\u6CAA\u5B81",
  "\u738B\u6D1B\u6797",
  "\u738B\u76CA",
  "\u738B\u80DC\u4FCA",
  "\u738B\u949F\u9E93",
  "\u738B\u96EA\u51B0",
  "\u738B\u9E3F\u4E3E",
  "\u73A9\u5973\u4EBA",
  "\u73A9\u5FFD\u804C\u5B88",
  "\u7530\u51E4\u5C71\u3002",
  "\u7530\u51E4\u5C90",
  "\u7531\u559C\u8D35",
  "\u7532\u57FA\u5B89\u975E\u4ED6\u660E",
  "\u7532\u777E\u916E",
  "\u7535\u51FB\u67AA",
  "\u7535\u72D7",
  "\u7535\u8B66\u68D2",
  "\u7535\u8BDD\u4EA4\u53CB",
  "\u7535\u8BDD\u5B9A\u4F4D\u5668",
  "\u7535\u8BDD\u62E6\u622A\u5668",
  "\u7535\u8BDD\u76D1",
  "\u7535\u8BDD\u7A83\u542C",
  "\u7535\u8BDD\u8FFD\u6740\u7CFB\u7EDF",
  "\u7535\u9E21",
  "\u754F\u7F6A\u81EA\u6740\u3002",
  "\u7559\u515A\u5BDF\u770B",
  "\u75C7\u8150",
  "\u767D\u6625\u793C",
  "\u76AE\u9ED4\u751F",
  "\u76D8\u53E4",
  "\u771F\u5584\u5FCD",
  "\u77F3\u5146\u5F6C",
  "\u798F\u97F3\u4F1A",
  "\u79E6\u660C\u5178 \u91CD\u5E86",
  "\u7A0B\u7EF4\u9AD8",
  "\u7C73\u51E4\u541B\u5409\u6797",
  "\u7C9F\u620E\u751F",
  "\u7D2B\u9633",
  "\u7ECF\u6D4E\u72AF\u7F6A",
  "\u7EDF\u4E00\u6559",
  "\u7F57\u4E91\u5149",
  "\u7F57\u7BAD",
  "\u7F8E\u6C99\u916E",
  "\u8000\u90A6",
  "\u8001j",
  "\u8001\u4E60",
  "\u8001\u5171",
  "\u8001\u6C5F",
  "\u8096\u6000\u67A2",
  "\u80E1boss",
  "\u80E1jintao",
  "\u80E1jt",
  "\u80E1j\u6D9B",
  "\u80E1x",
  "\u80E1\u4E3B\u5E2D",
  "\u80E1\u603B",
  "\u80E1\u60CA\u6D9B",
  "\u80E1\u6625\u534E",
  "\u80E1\u666F\u6D9B",
  "\u80E1\u6D3E",
  "\u80E1\u6D77\u5CF0",
  "\u80E1\u6D77\u6E05",
  "\u80E1\u6E29",
  "\u80E1\u738B\u516B",
  "\u80E1\u7D27\u5957",
  "\u80E1\u7D27\u638F",
  "\u80E1\u9526\u6D9B",
  "\u80E1\u957F\u6E05",
  "\u80F0\u5C9B\u7D20\u6837\u751F\u957F\u56E0\u5B50",
  "\u8150\u8D25",
  "\u81EAfen",
  "\u81EAsha",
  "\u81EA\u52A8\u8F9E",
  "\u81EA\u6740",
  "\u82CF\u6811\u6797",
  "\u82EF\u4E19\u80FA",
  "\u82EF\u5DF4\u6BD4\u59A5",
  "\u8303\u5E7F\u4E3E \u9ED1\u9F99\u6C5F",
  "\u8333\u6CFD\u6C11",
  "\u8346\u798F\u751F",
  "\u83AB\u8FBE\u975E\u5C3C",
  "\u843D\u9A6C",
  "\u8463\u5EFA\u534E",
  "\u84DD\u7530\u9020\u5047\u6848",
  "\u8521\u6B66",
  "\u8521\u8D74\u671D",
  "\u8584\u4E00\u6CE2",
  "\u8584\u7199",
  "\u8584\u7199\u6765",
  "\u85CF\u5B57\u77F3",
  "\u8881\u7EAF\u6E05",
  "\u88C6\u4E2D\u592E",
  "\u897F\u5E03\u66F2\u660E",
  "\u89C2\u97F3\u6CD5\u95E8",
  "\u8BB8\u5176\u4EAE",
  "\u8BB8\u5B97\u8861",
  "\u8BB8\u8FD0\u9E3F",
  "\u8BF8\u4E16\u7EAA",
  "\u8BFA\u67E5\u4E39\u739B\u65AF",
  "\u8D21\u6321",
  "\u8D2A20\u4EBF",
  "\u8D2A\u6C61",
  "\u8D2A\u8150\u8D22\u5BCC",
  "\u8D2A\u8D22\u7269",
  "\u8D3A\u56FD\u5F3A",
  "\u8D3A\u5B50\u73CD",
  "\u8D3E\u5E86\u6797",
  "\u8D3E\u5EF7\u5B89",
  "\u8D75\u6D2A\u795D",
  "\u8D77\u8BC9",
  "\u8D85\u8D8A\u7EA2\u5899",
  "\u8DEF\u752C\u7965",
  "\u8F66\u4ED1\u5DE5\u529B",
  "\u8F6E\u529F",
  "\u8F6E\u5B50\u529F",
  "\u8F6E\u6CD5\u529F",
  "\u8F9B\u4E1A\u6C5F \u6D77\u5357",
  "\u8FB9\u5C11\u658C",
  "\u8FDD\u7EAA",
  "\u9000dang",
  "\u9000\u515A",
  "\u90228\u5FC5\u707E",
  "\u90229\u5FC5\u4E71",
  "\u9022\u4E5D\u5FC5\u4E71",
  "\u9022\u516B\u5FC5\u707E",
  "\u9093xp",
  "\u9093\u5C0F\u5E73",
  "\u9093\u6653\u5E73",
  "\u9093\u6734\u65B9",
  "\u9093\u6995",
  "\u9093\u8D28\u65B9",
  "\u90AA\u515A",
  "\u90B1\u6653\u534E",
  "\u90B5\u677E\u9AD8",
  "\u90D1\u5149\u8FEA",
  "\u90D1\u7B71\u8438",
  "\u90ED\u4F2F\u96C4",
  "\u90ED\u91D1\u9F99",
  "\u91CC\u9E4F",
  "\u91D1\u5FB7\u7434 \u4E2D\u4FE1",
  "\u94C1\u51DD",
  "\u94C1\u82F1 \u5317\u4EAC",
  "\u950B\u540C\u5FD7",
  "\u9526\u6D9B",
  "\u963F\u5171",
  "\u963F\u66FC\u54C8\u5409",
  "\u963F\u8299\u84C9",
  "\u9648\u540C\u6D77",
  "\u9648\u5C11\u52C7",
  "\u9648\u5E0C\u540C",
  "\u9648\u5EFA\u56FD",
  "\u9648\u5FB7\u94ED",
  "\u9648\u5FE0",
  "\u9648\u6C34\u6587",
  "\u9648\u70B3\u5FB7",
  "\u9648\u7ECD\u57FA",
  "\u9648\u7EF4\u5E2D\u5B89\u5FBD",
  "\u9648\u81F3\u7ACB",
  "\u9648\u826F\u5B87",
  "\u96C4\u70EF\u4E8C\u9187",
  "\u96C6\u4F53\u81EA\u6740",
  "\u9756\u5FD7\u8FDC",
  "\u97E6\u6CFD\u82B3 \u6D77\u5357",
  "\u97E9\u6842\u829D",
  "\u97E9\u798F\u624D \u9752\u6D77",
  "\u9A6C\u607A",
  "\u9A6C\u70C8\u5B59\u5B81\u590F",
  "\u9A6C\u98DA",
  "\u9AD8\u4E25 \u56FD\u5BB6\u7535\u529B",
  "\u9AD8\u5B98\u540D\u5355",
  "\u9C81\u5BB6\u5584 \u4E2D\u56FD\u4EA4\u901A",
  "\u9E26\u7247",
  "\u9EA6\u5D07\u6977",
  "\u9EBB\u53E4",
  "\u9EBB\u9EC4\u8349",
  "\u9EC4\u4E3D\u6EE1",
  "\u9EC4\u5174\u56FD",
  "\u9EC4\u534E\u534E",
  "\u9EC4\u656C",
  "\u9EC4\u677E\u6709",
  "\u9EC4\u7476",
  "\u9EC4\u7EAA\u8BDA\u5317\u4EAC",
  "\u9EC4\u9547",
  "\u9F99\u65B0\u6C11"
];
var PORN_WORDS = [
  "18\u7981",
  "3P",
  "99bb",
  "SM",
  "a4u",
  "a4y",
  "adult",
  "amateur",
  "anal",
  "a\u7247",
  "cao\u4F60",
  "fuck",
  "gay\u7247",
  "g\u70B9",
  "g\u7247",
  "hardcore",
  "h\u52A8\u6F2B",
  "h\u52A8\u753B",
  "incest",
  "morphine",
  "narcotic",
  "porn",
  "sb",
  "secom",
  "sexinsex",
  "sm",
  "sm\u5973\u738B",
  "tokyohot",
  "xiao77",
  "xing\u4F34\u4FA3",
  "yin\u8361",
  "\u4E00ye\u60C5",
  "\u4E00\u4E1D\u4E0D\u6302",
  "\u4E00\u591C\u60C5",
  "\u4E00\u591C\u6B22",
  "\u4E00\u672C\u9053",
  "\u4E09\u7EA7\u7247",
  "\u4E0B\u4F53",
  "\u4E0B\u8D31",
  "\u4E0D\u7A7F",
  "\u4E1D\u889C",
  "\u4E1D\u8BF1",
  "\u4E2D\u5E74\u7F8E\u5987",
  "\u4E56\u4E56\u7C89",
  "\u4E70\u6625",
  "\u4E71\u4EA4",
  "\u4E71\u4F26",
  "\u4E71\u4F26\u5C0F",
  "\u4E71\u4F26\u7C7B",
  "\u4E71\u5978",
  "\u4E73\u4EA4",
  "\u4E73\u5934",
  "\u4E73\u623F",
  "\u4E73\u65B9",
  "\u4E73\u6C9F",
  "\u4E73\u7206",
  "\u4E9A\u60C5",
  "\u4EBA\u517D",
  "\u4EBA\u59BB",
  "\u4EBA\u6E23",
  "\u4ED3\u4E95\u7A7A",
  "\u4F26\u7406\u5927",
  "\u4F26\u7406\u6BDB",
  "\u4F26\u7406\u7247",
  "\u4F26\u7406\u7535\u5F71",
  "\u4F53\u4F4D",
  "\u4F53\u5978",
  "\u4F5C\u7231",
  "\u4F60\u4ED6\u5988",
  "\u4F60\u5417b",
  "\u4F60\u5988\u7684",
  "\u4F60\u9EBB\u75F9",
  "\u505A\u7231",
  "\u5077\u62CD",
  "\u5077\u6B22",
  "\u50BBb",
  "\u50BB\u6BD4",
  "\u50BB\u903C",
  "\u5168\u5BB6\u4E0D\u5F97\u597D\u6B7B",
  "\u5168\u5BB6\u6B7B\u5149",
  "\u5168\u5BB6\u6B7B\u7EDD",
  "\u5168\u88F8",
  "\u517D\u4EA4",
  "\u517D\u5978",
  "\u517D\u6027",
  "\u517D\u6B32",
  "\u5185\u5C04",
  "\u5185\u88E4",
  "\u5199\u771F",
  "\u51CC\u8FB1",
  "\u51E0\u5427",
  "\u522B\u4ED6\u5417",
  "\u5239\u7B14",
  "\u523A\u6FC0",
  "\u524D\u51F8\u540E\u7FD8",
  "\u5305\u4E8C\u5976",
  "\u5305\u591C",
  "\u5367\u69FD",
  "\u5367\u8279",
  "\u5395\u5974",
  "\u539F\u5473\u5185\u8863",
  "\u53CC\u81C0",
  "\u53D1\u60C5",
  "\u53D1\u6D6A",
  "\u53D1\u751F\u5173\u7CFB",
  "\u53E3\u4EA4",
  "\u53E3\u5C04",
  "\u53E3\u66B4",
  "\u53E3\u6D3B",
  "\u53E3\u6DEB",
  "\u53E3\u7206",
  "\u53EB\u5E8A",
  "\u5403\u7CBE",
  "\u540E\u5EAD",
  "\u540E\u7A74",
  "\u541E\u7CBE",
  "\u5438\u7CBE",
  "\u547B\u541F",
  "\u54AA\u54AA",
  "\u54C1\u9999\u5802",
  "\u55B7\u7CBE",
  "\u56FD\u4EA7av",
  "\u5904\u7537",
  "\u590F\u5DDD\u7EAF",
  "\u591A\u4EBA\u8F6E",
  "\u591C\u52E4\u75C5\u680B",
  "\u5927sb",
  "\u5927\u4E73",
  "\u5927\u529B\u62BD\u9001",
  "\u5927\u6CE2",
  "\u5931\u8EAB\u7C89",
  "\u5948\u7F8E",
  "\u5957\u5F04",
  "\u5973\u4F18",
  "\u5976\u5B50",
  "\u5978\u60C5",
  "\u597D\u5AE9",
  "\u5988\u4E86\u4E2A\u903C",
  "\u5988\u903C",
  "\u5993\u5973",
  "\u59B9\u4E0A\u95E8",
  "\u59B9\u6309\u6469",
  "\u5A18\u897F\u76AE",
  "\u5A4A\u5B50",
  "\u5A4A\u5B50\u517B\u7684",
  "\u5A9A\u5916",
  "\u5AE9\u5973",
  "\u5AE9\u7A74",
  "\u5AE9\u903C",
  "\u5B66\u751F\u59B9",
  "\u5BC2\u5BDE\u5973",
  "\u5BC2\u5BDE\u7537",
  "\u5BC6\u7A74",
  "\u5C01\u9762\u5973\u90CE",
  "\u5C04\u723D",
  "\u5C04\u7CBE",
  "\u5C04\u989C",
  "\u5C0Fxue",
  "\u5C0F\u7A74",
  "\u5C0F\u903C",
  "\u5C11\u4FEE\u6B63",
  "\u5C11\u5987",
  "\u5C11\u5E74\u963F\u5BBE",
  "\u5C31\u53BB\u65E5",
  "\u5C41\u773C",
  "\u5C41\u80A1",
  "\u5DE8\u4E73",
  "\u5DE8\u5976",
  "\u5DE8\u5C4C",
  "\u5E72\u4F60",
  "\u5E72\u4F60\u5988",
  "\u5E72\u4F60\u5A18",
  "\u5E72\u6B7B",
  "\u5E72\u6B7B\u4F60",
  "\u5E72\u7A74",
  "\u5E7C\u4EA4",
  "\u5E7C\u5973",
  "\u5E7C\u7537",
  "\u5E94\u53EC",
  "\u5F00\u82DE",
  "\u5F20\u7B71\u96E8",
  "\u5F3Ajian",
  "\u5F3A\u5978",
  "\u5F3A\u5978\u5904\u5973",
  "\u5F3A\u66B4",
  "\u5FEB\u611F",
  "\u6027\u4EA4",
  "\u6027\u4EA4\u56FE\u7247",
  "\u6027\u4EA4\u89C6\u9891",
  "\u6027\u4F19\u4F34",
  "\u6027\u4F34\u4FA3",
  "\u6027\u5974",
  "\u6027\u5974\u96C6\u4E2D\u8425",
  "\u6027\u606F",
  "\u6027\u611F\u5996\u5A06",
  "\u6027\u611F\u5C11",
  "\u6027\u611F\u8BF1\u60D1",
  "\u6027\u6280\u5DE7",
  "\u6027\u670D\u52A1",
  "\u6027\u6B32",
  "\u6027\u7231",
  "\u6027\u798F\u60C5",
  "\u6027\u864E",
  "\u6027\u8650",
  "\u6027\u9965\u6E34",
  "\u60C5\u8272",
  "\u60C5\u8DA3\u7528\u54C1",
  "\u60F9\u706B\u8EAB\u6750",
  "\u6210\u4EBAdv",
  "\u6210\u4EBA\u5361\u901A",
  "\u6210\u4EBA\u56FE",
  "\u6210\u4EBA\u5C0F",
  "\u6210\u4EBA\u5C0F\u8BF4",
  "\u6210\u4EBA\u6587",
  "\u6210\u4EBA\u6587\u5B66",
  "\u6210\u4EBA\u6E38\u620F",
  "\u6210\u4EBA\u7247",
  "\u6210\u4EBA\u7535",
  "\u6210\u4EBA\u7535\u5F71",
  "\u6210\u4EBA\u7F51\u7AD9",
  "\u6210\u4EBA\u804A",
  "\u6210\u4EBA\u8272\u60C5",
  "\u6210\u4EBA\u89C6",
  "\u6210\u4EBA\u8BBA\u575B",
  "\u6211\u5C31\u8272",
  "\u6211\u5E72",
  "\u6211\u64CD",
  "\u6211\u65E5\u4F60",
  "\u6211\u8349",
  "\u624B\u6DEB",
  "\u624C\u7531\u63D2",
  "\u6293\u80F8",
  "\u62BD\u4E00\u63D2",
  "\u62BD\u63D2",
  "\u62D4\u51FA\u6765",
  "\u62DB\u5993",
  "\u62DB\u9E21",
  "\u62F3\u4EA4",
  "\u6309\u6469\u68D2",
  "\u634F\u5F04",
  "\u6362\u59BB\u4FF1\u4E50\u90E8",
  "\u63C9\u4E73",
  "\u63D2b",
  "\u63D2\u4F60",
  "\u63D2\u6211",
  "\u63D2\u66B4",
  "\u63D2\u6BD4",
  "\u63D2\u8FDB",
  "\u63D2\u903C",
  "\u63D2\u9634",
  "\u63F4\u4EA4",
  "\u63F4\u52A9\u4EA4\u9645",
  "\u6447\u5934\u4E38",
  "\u6478\u5976",
  "\u6478\u80F8",
  "\u64CD\u4ED6\u5988",
  "\u64CD\u4F60\u5168\u5BB6",
  "\u64CD\u4F60\u5927\u7237",
  "\u64CD\u4F60\u5988",
  "\u64CD\u4F60\u5A18",
  "\u64CD\u4F60\u7956\u5B97",
  "\u64CD\u6211",
  "\u64CD\u6B7B",
  "\u64CD\u70C2",
  "\u64CD\u903C",
  "\u64CD\u9ED1",
  "\u64E6\u4F60\u5988",
  "\u653E\u5C3F",
  "\u6587\u505A",
  "\u65E0\u4FEE\u6B63",
  "\u65E0\u7801",
  "\u65E0\u803B",
  "\u65E5\u4F60\u5988",
  "\u65E5\u70C2",
  "\u65E5\u903C",
  "\u6625\u836F",
  "\u66B4\u4E73",
  "\u66B4\u5978",
  "\u66B4\u5E72",
  "\u66B4\u6DEB",
  "\u6740b",
  "\u6768\u601D\u654F",
  "\u677E\u5C9B\u67AB",
  "\u6821\u9E21",
  "\u697C\u51E4",
  "\u6B20\u5E72",
  "\u6B32\u4ED9\u6B32\u6B7B",
  "\u6B32\u5973",
  "\u6B32\u706B",
  "\u6B7B\u5168\u5BB6",
  "\u6B7B\u903C",
  "\u6BCD\u5978",
  "\u6BD2\u9F99",
  "\u6C64\u52A0\u4E3D",
  "\u6C99\u6BD4",
  "\u6D41\u6DEB",
  "\u6D51\u5706",
  "\u6D6A\u53EB",
  "\u6D6A\u5973",
  "\u6D6A\u5987",
  "\u6D6A\u903C",
  "\u6DEB\u4E66",
  "\u6DEB\u4E71",
  "\u6DEB\u4EB5",
  "\u6DEB\u517D",
  "\u6DEB\u517D\u5B66",
  "\u6DEB\u517D\u5B66\u56ED",
  "\u6DEB\u53EB",
  "\u6DEB\u58F0\u6D6A\u8BED",
  "\u6DEB\u5973",
  "\u6DEB\u5987",
  "\u6DEB\u59BB",
  "\u6DEB\u5A01",
  "\u6DEB\u5A03",
  "\u6DEB\u5A9A",
  "\u6DEB\u60C5",
  "\u6DEB\u60C5\u5973",
  "\u6DEB\u6559\u5E08",
  "\u6DEB\u672F\u70BC\u91D1\u58EB",
  "\u6DEB\u6837",
  "\u6DEB\u6BCD",
  "\u6DEB\u6C34",
  "\u6DEB\u6CB3",
  "\u6DEB\u6D6A",
  "\u6DEB\u6DB2",
  "\u6DEB\u7167",
  "\u6DEB\u7535\u5F71",
  "\u6DEB\u7A74",
  "\u6DEB\u7CDC",
  "\u6DEB\u8089",
  "\u6DEB\u8272",
  "\u6DEB\u8361",
  "\u6DEB\u8361\u7167\u7247",
  "\u6DEB\u8361\u7F8E\u5973",
  "\u6DEB\u8361\u81EA\u6170\u5668",
  "\u6DEB\u8361\u89C6\u9891",
  "\u6DEB\u8650",
  "\u6DEB\u866B",
  "\u6DEB\u8D31",
  "\u6DEB\u9761",
  "\u6DEB\u9A37\u59B9",
  "\u6DEB\u9B54",
  "\u6DEB\u9B54\u821E",
  "\u6DF7\u86CB",
  "\u6F0F\u4E73",
  "\u6F6E\u5439",
  "\u6F6E\u55B7",
  "\u6FC0\u60C5",
  "\u706B\u8FA3",
  "\u70AE\u53CB",
  "\u715E\u7B14",
  "\u715E\u903C",
  "\u719F\u5973",
  "\u719F\u5987",
  "\u719F\u6BCD",
  "\u7206\u4E73",
  "\u7206\u4F60\u83CA",
  "\u7206\u8349",
  "\u7231\u5973\u4EBA",
  "\u7231\u6DB2",
  "\u723D\u6B7B\u6211\u4E86",
  "\u723D\u7247",
  "\u72C2\u63D2",
  "\u72C2\u64CD",
  "\u72D7\u5A18\u517B",
  "\u72D7\u64CD",
  "\u72D7\u65E5\u7684",
  "\u72D7\u6742\u79CD",
  "\u72D7\u8349",
  "\u72FC\u53CB",
  "\u731B\u7537",
  "\u7389\u4E73",
  "\u7389\u5973\u5FC3\u7ECF",
  "\u7389\u7A74",
  "\u7389\u84B2\u56E2",
  "\u7537\u516C\u5173",
  "\u7537\u5974",
  "\u767D\u5AE9",
  "\u767D\u75F4",
  "\u76D7\u64AE",
  "\u76F8\u5978",
  "\u771F\u4ED6\u5988",
  "\u7832\u53CB",
  "\u79D8\u5507",
  "\u7A74\u53E3",
  "\u7A74\u56FE",
  "\u7C89\u5AE9",
  "\u7C89\u7A74",
  "\u7CBE\u5B50",
  "\u7CBE\u6DB2",
  "\u7CBE\u795E\u836F\u54C1",
  "\u7F8E\u4E73",
  "\u7F8E\u5973\u4E0A\u95E8",
  "\u7F8E\u5973\u5199\u771F",
  "\u7F8E\u5973\u88F8\u4F53",
  "\u7F8E\u5C11\u5987",
  "\u7F8E\u5E7C",
  "\u7F8E\u7A74",
  "\u7F8E\u817F",
  "\u7F8E\u8273\u5C11\u5987",
  "\u7F8E\u903C",
  "\u7FA4\u4EA4",
  "\u804A\u6027",
  "\u8089\u5177",
  "\u8089\u5507",
  "\u8089\u68CD",
  "\u8089\u68D2",
  "\u8089\u6B32",
  "\u8089\u6D1E",
  "\u8089\u7A74",
  "\u8089\u7F1D",
  "\u8089\u830E",
  "\u8089\u903C",
  "\u808F\u4F60",
  "\u808F\u6B7B",
  "\u809B\u4EA4",
  "\u809B\u95E8",
  "\u80A5\u903C",
  "\u811A\u4EA4",
  "\u8131\u5149",
  "\u8131\u5185\u88E4",
  "\u81EA\u6170",
  "\u81EA\u62CD",
  "\u8214\u811A",
  "\u8214\u9634",
  "\u821E\u5973",
  "\u8272b",
  "\u8272\u533A",
  "\u8272\u59B9\u59B9",
  "\u8272\u5C0F\u8BF4",
  "\u8272\u60C5\u56FE\u7247",
  "\u8272\u60C5\u5C0F\u8BF4",
  "\u8272\u60C5\u5F71\u7247",
  "\u8272\u60C5\u670D\u52A1",
  "\u8272\u60C5\u7247",
  "\u8272\u60C5\u7535\u5F71",
  "\u8272\u60C5\u7F51\u7AD9",
  "\u8272\u60C5\u8868\u6F14",
  "\u8272\u6B32",
  "\u8272\u732B",
  "\u8272\u7535\u5F71",
  "\u8272\u754C",
  "\u8272\u76DF",
  "\u8272\u8272",
  "\u8272\u89C6\u9891",
  "\u8272\u8BF1",
  "\u8272\u903C",
  "\u8273\u60C5\u5C0F\u8BF4",
  "\u8279\u4F60",
  "\u82B1\u82B1\u516C\u5B50",
  "\u8349\u4F60\u4E2B",
  "\u8349\u4F60\u5417",
  "\u8361\u5973",
  "\u8361\u5987",
  "\u83CA\u7A74",
  "\u83CA\u82B1\u6D1E",
  "\u83CA\u95E8",
  "\u864E\u9A91",
  "\u871C\u6DB2",
  "\u871C\u7A74",
  "\u88AB\u5E72",
  "\u88AB\u63D2",
  "\u88AB\u64CD",
  "\u88C5b",
  "\u88D9\u4E2D\u6027\u8FD0\u52A8",
  "\u88E4\u889C",
  "\u88F8\u4F53\u5199\u771F",
  "\u88F8\u7167",
  "\u88F8\u804A",
  "\u88F8\u804A\u7F51",
  "\u88F8\u821E\u89C6",
  "\u88F8\u966A",
  "\u88F8\u9732",
  "\u88F9\u672C",
  "\u8981\u5C04\u4E86",
  "\u8BF1\u5978",
  "\u8C03\u6559",
  "\u8C1C\u5978\u836F",
  "\u8C6A\u4E73",
  "\u8D31b",
  "\u8D31\u4EBA",
  "\u8D31\u6BD4",
  "\u8D31\u8D27",
  "\u8D64\u88F8",
  "\u8DB3\u4EA4",
  "\u8F6E\u5978",
  "\u8F6E\u64CD",
  "\u8F6E\u66B4",
  "\u8FF7\u5978",
  "\u8FF7\u5978\u7C89",
  "\u8FF7\u5978\u836F",
  "\u8FF7\u5E7B\u836F",
  "\u8FF7\u5E7B\u85E5",
  "\u8FF7\u60C5\u6C34",
  "\u8FF7\u60C5\u7C89",
  "\u8FF7\u60C5\u836F",
  "\u8FF7\u660F\u53E3",
  "\u8FF7\u660F\u836F",
  "\u8FF7\u660F\u85E5",
  "\u8FF7\u836F",
  "\u8FF7\u85E5",
  "\u8FF7\u9B42\u836F",
  "\u8FF7\u9B42\u85E5",
  "\u8FF7\u9B42\u9999",
  "\u903C\u5978",
  "\u9165\u75D2",
  "\u91CA\u6B32",
  "\u91D1\u9CDE\u5C82\u662F\u6C60\u4E2D\u7269",
  "\u91D1\u9E9F\u5C82\u662F\u6C60\u4E2D\u7269",
  "\u94C3\u6728\u9EBB",
  "\u9609\u5272",
  "\u9633\u5177",
  "\u9634b",
  "\u9634\u5507",
  "\u9634\u6237",
  "\u9634\u6838",
  "\u9634\u6BDB",
  "\u9634\u7CBE",
  "\u9634\u830E",
  "\u9634\u830E\u52A9\u52C3",
  "\u9634\u830E\u589E\u5927",
  "\u9634\u8482",
  "\u9634\u9053",
  "\u9634\u90E8",
  "\u9634\u95F4\u6765\u7535",
  "\u9634\u961C",
  "\u9670\u5507",
  "\u9670\u6236",
  "\u9670\u9053",
  "\u96C6\u4F53\u6DEB",
  "\u9732b",
  "\u989C\u5C04",
  "\u98CE\u6708\u5927\u9646",
  "\u98CE\u9A9A",
  "\u98DF\u7CBE",
  "\u9A6C\u52D2",
  "\u9A9A\u5634",
  "\u9A9A\u5973",
  "\u9A9A\u5987",
  "\u9A9A\u6BD4",
  "\u9A9A\u6C34",
  "\u9A9A\u6D6A",
  "\u9A9A\u7A74",
  "\u9A9A\u8D27",
  "\u9A9A\u903C",
  "\u9AD8\u6F6E",
  "\u9E21\u5427",
  "\u9E21\u5978",
  "\u9E21\u5DF4",
  "\u9EBB\u75F9\u7684",
  "\u9EBB\u9189\u836F",
  "\u9EC4\u7247",
  "\u9ED1\u903C",
  "\u9F9F\u5934"
];
var ILLEGAL_WORDS = [
  "64\u5F0F\u624B\u67AA\u51FA\u552E",
  "92\u5F0F\u624B\u67AA\u51FA\u552E",
  "ATOM\u5F39\u5236\u9020",
  "C4\u5851\u80F6\u70B8\u836F",
  "C4\u70B8\u836F",
  "C4\u70B8\u836F\u7684\u6210\u5206",
  "DIY\u539F\u5B50\u5F39",
  "DIY\u6838\u5F39",
  "TNT \u70B8\u5F39\u7684\u5236\u4F5C",
  "TNT\u70B8\u5F39\u5236\u4F5C",
  "Zha\u836F\u5236\u9020\u8FDB\u7A0B",
  "tnt\u70B8\u836F\u6210\u5206",
  "tnt\u70B8\u836F\u914D\u65B9",
  "zz\u70B8\u5F39\u7684\u5236\u4F5C\u65B9\u6CD5",
  "\u300C\u7EA2\u70E7\u5154\u5B50\u300D\u5927\u9910",
  "\u3010\u624B\u67AA\u51FA\u552E\u3011\u8054\u7CFB\u7535\u8BDD",
  "\u4E09\u5206\u949F\u6559\u4F60\u539F\u5B50\u5F39",
  "\u4E09\u5229\u8FBE\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u4E09\u5229\u8FBE\u5F13\u5F29\u519B\u5200",
  "\u4E09\u5229\u8FBE\u5F13\u5F29\u76F4\u8425",
  "\u4E09\u5229\u8FBE\u5F13\u5F29\u914D\u4EF6",
  "\u4E09\u68F1\u519B\u523A\u4E13\u5356",
  "\u4E09\u6B65\u5012\u5F29\u7BAD\u4E13\u5356",
  "\u4E09\u6B65\u5012\u6355\u72D7\u836F",
  "\u4E09\u6B65\u5012\u836F\u7BAD\u6279\u53D1",
  "\u4E09\u6B65\u5012\u9EBB\u9189\u5F29\u7BAD\u9500\u552E",
  "\u4E09\u6B65\u5012\u9EBB\u9189\u7BAD",
  "\u4E09\u6B65\u5012\u9EBB\u9189\u7BAD\u4E13\u5356",
  "\u4E09\u7BAD\u6C14\u67AA\u51FA\u552E",
  "\u4E0B\u785D\u5316\u7518\u6CB9\u7684\u5236\u4F5C\u65B9\u6CD5",
  "\u4E13\u4E1A\u5F13\u5F29\u7F51",
  "\u4E2D\u56FD\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u4E2D\u56FD\u5F13\u5F29\u72E9\u730E\u7F51",
  "\u4E2D\u56FD\u5F13\u5F29\u76F4\u9500",
  "\u4E2D\u56FD\u5F13\u5F29\u7F51",
  "\u4E2D\u56FD\u5F13\u9A7D\u7F51",
  "\u4E2D\u56FD\u5F29\u5F13\u4E13\u5356",
  "\u4E2D\u56FD\u6218\u795E\u519B\u7528\u5F13\u5F29",
  "\u4E2D\u56FD\u6237\u5916\u5200\u5177\u7F51",
  "\u4E70\u535654\u72D7",
  "\u4E70\u535664\u72D7",
  "\u4E70\u5356\u519B\u72D7",
  "\u4E70\u5356\u519B\u7528\u67AA\u652F",
  "\u4E70\u5356\u8B66\u5BDF\u67AA\u652F",
  "\u4EBA\u4F53\u70B8\u5F39\u5236\u4F5C\u6D41\u7A0B",
  "\u4ED9\u9E64\u6C14\u67AA\u51FA\u552E",
  "\u4EE3\u5B55\u5988\u5988",
  "\u4EE3\u5F00\u53D1\u7968",
  "\u4EE3\u751F\u5B69\u5B50",
  "\u4EFF\u54C1\u519B\u523A\u51FA\u552E",
  "\u4EFF\u54C1\u519B\u523A\u7F51",
  "\u4EFF\u771F\u67AAQQ",
  "\u4F60\u600E\u4E48\u7528\u571F\u529E\u6CD5\u505A\u6B66\u5668",
  "\u4F9B\u5E94\u4E09\u5229\u8FBE\u5F13\u5F29\u9EBB\u9189\u7BAD",
  "\u4F9B\u5E94\u4E09\u6B65\u5012\u9EBB\u9189\u7BAD",
  "\u4F9B\u5E94\u519B\u7528\u5F13\u5F29\u4E13\u5356",
  "\u4F9B\u5E94\u519B\u7528\u5F29\u6298\u53E0\u5F29",
  "\u4F9B\u5E94\u519B\u7528\u624B\u67AA",
  "\u4F9B\u5E94\u5F13\u5F29",
  "\u4F9B\u5E94\u5F13\u5F29\u9EBB\u9189\u7BAD",
  "\u4F9B\u5E94\u5F29\u6355\u72D7\u7BAD",
  "\u4F9B\u5E94\u5F29\u7528\u9EBB\u9189\u7BAD",
  "\u4F9B\u5E94\u6C7D\u67AA",
  "\u4F9B\u5E94\u79E6\u6C0F\u5F13\u5F29",
  "\u4F9B\u5E94\u7CBE\u54C1\u5F13\u5F29",
  "\u4F9B\u5E94\u94A2\u73E0\u5F13\u5F29",
  "\u4F9B\u5E94\u9EBB\u9189\u7BAD",
  "\u4F9B\u5E94\u9EBB\u9189\u7BAD\u4E09\u6B65\u5012",
  "\u4F9B\u5E94\u9EBB\u9189\u7BAD\u6279\u53D1",
  "\u4FE1\u7528\u5361\u63D0\u73B0",
  "\u501F\u8179\u751F\u5B50",
  "\u5168\u91D1\u5C5E\u4EFF\u771F\u67AA\u4E13\u5356",
  "\u5199\u7684\u70B8\u5F39\u5236\u4F5C\u6559\u7A0B",
  "\u519B\u5200\u4E13 \u5356",
  "\u519B\u5200\u4E13\u5356\u519B\u523A",
  "\u519B\u5200\u4E13\u5356\u5200\u5177\u6279\u53D1",
  "\u519B\u5200\u4EF7\u683C\u519B\u7528\u5200\u5177",
  "\u519B\u5200\u519B\u523A\u7529\u68CD",
  "\u519B\u5200\u519B\u54C1\u7F51",
  "\u519B\u5200\u5315\u9996\u76F4\u9500\u7F51",
  "\u519B\u5200\u56FE\u7247\u780D\u5200",
  "\u519B\u5200\u7529\u68CD\u9500\u552E",
  "\u519B\u5200\u7535\u68CD\u9500\u552E",
  "\u519B\u5200\u76F4\u5200\u4E13\u5356",
  "\u519B\u5200\u76F4\u5200\u519B\u54C1\u7F51",
  "\u519B\u5200\u76F4\u9500\u7F51",
  "\u519B\u5200\u7F51",
  "\u519B\u5200\u7F51\u519B\u5200\u4E13\u5356",
  "\u519B\u523A\u91CE\u8425\u780D\u5200\u51FA\u552E",
  "\u519B\u54C1\u519B\u523A\u7F51",
  "\u519B\u752854\u51FA\u552E",
  "\u519B\u752877\u51FA\u552E",
  "\u519B\u7528\u5200\u5177\u519B\u54C1\u7F51",
  "\u519B\u7528\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u519B\u7528\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u519B\u7528\u5F13\u5F29\u516C\u53F8",
  "\u519B\u7528\u5F13\u5F29\u6279\u53D1",
  "\u519B\u7528\u624B\u67AA\u94A2\u73E0\u67AA",
  "\u51B7\u94A2\u5200\u5177\u4E13\u5356",
  "\u51B7\u94A2\u5200\u5177\u519B\u54C1\u7F51",
  "\u51B7\u94A2\u5200\u5177\u76F4\u9500\u7F51",
  "\u51FA\u552E54\u5F0F\u624B\u67AA",
  "\u51FA\u552E:\u9AD8\u4EFF\u771F\u67AA",
  "\u51FA\u552EM1911",
  "\u51FA\u552E\u4E09\u68F1\u5200",
  "\u51FA\u552E\u4EFF\u771F\u67AA",
  "\u51FA\u552E\u519B\u5200",
  "\u51FA\u552E\u519B\u523A",
  "\u51FA\u552E\u519B\u523A\u519B\u5200",
  "\u51FA\u552E\u519B\u54C1\u519B\u5200",
  "\u51FA\u552E\u5404\u7C7B\u730E\u72D7",
  "\u51FA\u552E\u56FD\u4EA7\u519B\u752854\u624B\u67AA",
  "\u51FA\u552E\u5916\u56FD\u67AA\u6A21",
  "\u51FA\u552E\u5F00\u5C71\u5200\u519B\u523A",
  "\u51FA\u552E\u5F39\u7C27\u5200",
  "\u51FA\u552E\u624B\u67AA",
  "\u51FA\u552E\u624B\u67AA QQ",
  "\u51FA\u552E\u624B\u67AA \u7535\u8BDD",
  "\u51FA\u552E\u624B\u67AA=\u8D27\u5230\u4ED8\u6B3E",
  "\u51FA\u552E\u624B\u72D7",
  "\u51FA\u552E\u6B65\u67AA",
  "\u51FA\u552E\u6C14\u67AA",
  "\u51FA\u552E\u6C14\u67AA QQ",
  "\u51FA\u552E\u6C14\u67AA \u7535\u8BDD",
  "\u51FA\u552E\u6C14\u72D7",
  "\u51FA\u552E\u6C7D\u67AA",
  "\u51FA\u552E\u706B\u67AA \u2013\u6E38\u620F",
  "\u51FA\u552E\u70B8\u836F",
  "\u51FA\u552E\u70B8\u836F \u7535\u8BDD",
  "\u51FA\u552E\u70B8\u836FQQ",
  "\u51FA\u552E\u72D9\u51FB\u67AA",
  "\u51FA\u552E\u730E\u67AA",
  "\u51FA\u552E\u730E\u67AA QQ",
  "\u51FA\u552E\u730E\u67AA \u7535\u8BDD",
  "\u51FA\u552E\u730E\u72D7",
  "\u51FA\u552E\u7F8E\u519B\u73B0\u5F79\u519B\u5200",
  "\u51FA\u552E\u8896\u73CD\u624B\u67AA",
  "\u51FA\u552E\u8B66\u7528\u624B\u94D0|\u4EFF\u771F\u67AA",
  "\u51FA\u552E\u8DF3\u5200",
  "\u51FA\u552E\u8FDB\u53E3\u91D1\u5C5E\u67AA\u6A21",
  "\u51FA\u552E\u96F7\u7BA1",
  "\u51FA\u552E\u96F7\u7BA1\u70B8\u836F",
  "\u51FA\u552E\u9EBB\u9189\u67AA\u514D\u6536\u4EFB\u4F55\u5B9A\u91D1",
  "\u5200\u5177\u76F4\u9500\u7F51",
  "\u5236\u4F5C\u6027\u80FD\u4F18\u826F\u7684\u71C3\u70E7\u5F39",
  "\u5236\u4F5C\u706B\u836F\u914D\u65B9",
  "\u5236\u4F5C\u70B8\u5F39\u9996\u5148\u8981",
  "\u5236\u4F5C\u785D\u5316\u7518\u6CB9",
  "\u5236\u4F5C\u7B80\u6613\u5F13\u5F29",
  "\u523A\u5200\u4E13\u5356\u7F51",
  "\u52C3\u6717\u5B81\u519B\u5200",
  "\u5315\u9996\u8774\u8776\u7529\u5200\u4E13\u5356",
  "\u5317\u65B9\u5148\u950B\u519B\u5200",
  "\u535664\u624B\u67AA",
  "\u535692\u624B\u67AA",
  "\u5356\u94A2\u73E0\u67AAQQ",
  "\u5357\u65B9\u519B\u5200\u7F51",
  "\u539F\u5B50\u5F39 \u5236\u4F5C\u65B9\u6CD5",
  "\u539F\u5B50\u5F39DIY\u6559\u7A0B",
  "\u539F\u5B50\u5F39\u5236\u4F5C",
  "\u539F\u5B50\u5F39\u5236\u4F5C \u65B9\u6CD5",
  "\u539F\u5B50\u5F39\u5236\u4F5C\u624B\u518C",
  "\u539F\u5B50\u5F39\u5236\u4F5C\u65B9\u6CD5",
  "\u539F\u5B50\u5F39\u5236\u4F5C\u65B9\u6CD5DIY",
  "\u539F\u5B50\u5F39\u5236\u9020\u5B8C\u5168\u624B\u518C",
  "\u539F\u5B50\u5F39\u914D\u65B9",
  "\u53EF\u5851\u70B8\u5F39\u5236\u4F5C",
  "\u53EF\u5851\u70B8\u5F39\u5236\u4F5C\u65B9\u6CD5",
  "\u53F8\u9A6C\u4EFF\u771F\u67AA\u6A21\u578BQQ",
  "\u5404\u5F0F\u6C14\u67AA\u51FA\u552E",
  "\u5404\u79CD\u70B8\u836F\u914D\u65B9\u5927\u5168",
  "\u5404\u7C7B\u519B\u7528\u67AA",
  "\u5404\u7C7B\u519B\u7528\u67AA\u652F",
  "\u54EA\u80FD\u4E70\u5230\u771F\u67AA",
  "\u54EA\u91CC\u6709\u5356\u53CC\u7BA1\u730E",
  "\u54EA\u91CC\u6709\u67AA\u51FA\u552E",
  "\u54EA\u91CC\u6709\u6C14\u67AA\u5356",
  "\u54EA\u91CC\u6709\u771F\u67AA\u51FA\u552E",
  "\u54EA\u91CC\u6709\u771F\u67AA\u5356\u4E70",
  "\u54EA\u91CC\u6709\u8FDE\u53D1\u730E\u67AA\u4E70\u5356",
  "\u54EA\u91CC\u6709\u94A2\u73E0\u67AA",
  "\u54EA\u91CC\u80FD\u4E70\u5230\u81EA\u5236\u624B\u67AA",
  "\u552E\u624B\u67AAQQ",
  "\u552E\u67AA\u8D2D\u4E70\u624B\u67AA",
  "\u56FD\u4EA7\u6C7D\u72D7\u4E13\u5356|\u6C14\u67AA\u8D27",
  "\u571F\u70B8\u836F\u6210\u4EFD",
  "\u5728\u5BB6\u91CC\u505A\u539F\u5B50\u5F39",
  "\u57FA\u672C\u914D\u65B9\u662F\u785D\u9178\u7518",
  "\u5851\u80F6\u70B8\u5F39",
  "\u5982\u4F55\u5236\u785D\u5316\u7518\u6CB9",
  "\u5982\u4F55\u81EA\u5236\u71C3\u70E7\u5F39",
  "\u5A25\u7709\u6C14\u67AA\u51FA\u552E",
  "\u5B50\u5F39\u8D27\u5230\u4ED8\u6B3E",
  "\u5C0F\u53E3\u5F84\u79C3\u9E70\u6C99\u6F20",
  "\u5C0F\u578B\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u5C0F\u730E\u4EBA\u5F13\u5F29\u7F51",
  "\u5C3C\u6CCA\u5C14\u519B\u5200\u51FA\u552E",
  "\u5DE5\u5B57\u6C7D\u72D7\u9EBB\u9189\u67AA",
  "\u5DE5\u5B57\u724C\u6C14\u67AA\u51FA\u552E\u4E13\u5356",
  "\u5F00\u5C71\u5200\u780D\u5200\u51FA\u552E",
  "\u5F13\u5F29\u4E00\u767E\u4E13\u5356\u5E97",
  "\u5F13\u5F29\u4E13\u5356",
  "\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u5F13\u5F29\u4E13\u5356\u5E97\u7F51",
  "\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u5F13\u5F29\u4E13\u5356\u7F51\u8D27\u5230\u4ED8\u6B3E",
  "\u5F13\u5F29\u4E13\u5356\u8D27\u5230\u4ED8\u6B3E",
  "\u5F13\u5F29\u4E13\u8425",
  "\u5F13\u5F29\u4EB2\u5144\u5F1F\u8D27\u5230\u4ED8\u6B3E",
  "\u5F13\u5F29\u514D\u5B9A\u91D1\u8D27\u5230\u4ED8\u6B3E",
  "\u5F13\u5F29\u5236\u4F5C",
  "\u5F13\u5F29\u5546\u57CE",
  "\u5F13\u5F29\u5546\u57CE\u4E13\u5356",
  "\u5F13\u5F29\u56FE\u7EB8",
  "\u5F13\u5F29\u6279\u53D1",
  "\u5F13\u5F29\u6709\u9650\u516C\u53F8",
  "\u5F13\u5F29\u7279\u8BB8\u7ECF\u9500",
  "\u5F13\u5F29\u72E9\u730E\u7F51",
  "\u5F13\u5F29\u76F4\u9500",
  "\u5F13\u5F29\u7F51",
  "\u5F13\u5F29\u8425\u9500\u4E2D\u5FC3",
  "\u5F13\u5F29\u8BBA\u575B",
  "\u5F13\u5F29\u9500\u552E",
  "\u5F13\u5F29\u9EBB\u9189\u7BAD",
  "\u5F13\u5F29\u9EBB\u9189\u9556",
  "\u5F39\u836F\u5236\u9020\u65B9\u6CD5",
  "\u600E\u4E48\u7528\u571F\u529E\u6CD5\u505A\u6B66\u5668",
  "\u600E\u4E48\u81EA\u5236\u71C3\u70E7\u5F39",
  "\u6050\u6016\u5206\u5B50\u50BB\u74DC\u624B\u518C",
  "\u6050\u6016\u5206\u5B50\u81EA\u5DF1\u5236\u9020\u70B8\u5F39",
  "\u6208\u535A\u519B\u5200",
  "\u6218\u672F\u519B\u5200\u51FA\u552E",
  "\u6237\u5916\u519B\u5200\u51FA\u552E",
  "\u6237\u5916\u519B\u5200\u7F51",
  "\u624B\u5DE5\u730E\u5200\u4E13\u5356",
  "\u624B\u5DE5\u730E\u5200\u6237\u5916\u5200\u5177",
  "\u624B\u628A\u624B\u6559\u4F60\u505A\u70B8\u5F39",
  "\u624B\u628A\u624B\u6559\u4F60\u5236\u4F5C\u539F\u5B50\u5F39",
  "\u624B\u6559\u4F60\u505A\u539F\u5B50\u5F39",
  "\u624B\u6559\u4F60\u5236\u4F5C\u539F\u5B50\u5F39",
  "\u624B\u67AA|\u963B\u51FB\u67AA",
  "\u624B\u67AA\u5F0F\u6298\u53E0\u4E09\u7528\u5F29",
  "\u624B\u67AA\u6C14* \u67AA\u730E",
  "\u624B\u67C4\u5236\u4F5C\u70B8\u5F39\u5F15\u7206\u5668",
  "\u624B\u69CD\u4E70\u5356\u81EA\u5236\u624B\u67AA",
  "\u6253\u72D7\u5F13\u5F29\u4E09\u6B65\u5012",
  "\u627E\u4E2A\u5988\u5988",
  "\u627E\u4E2A\u7238\u7238",
  "\u6298\u5200\u4E13\u5356\u7F51",
  "\u6298\u5200\u780D\u5200\u4E13\u5356",
  "\u6298\u5200\u780D\u5200\u519B\u54C1\u7F51",
  "\u6298\u53E0\u72D7QQ",
  "\u63D0\u4F9B\u4E13\u4E1A\u53CA\u65F6\u7684\u6C14\u72D7",
  "\u63D0\u4F9B\u6C14\u72D7\u4E13\u5356\u5E97",
  "\u6559\u4F60\u5236\u4F5C\u539F\u5B50\u5F39",
  "\u6559\u4F60\u600E\u4E48\u7528\u571F\u529E\u6CD5\u505A\u6B66\u5668",
  "\u65E0\u62B5\u62BC\u8D37\u6B3E",
  "\u6700\u65B0\u9500\u552E\u6C7D\u72D7",
  "\u6709\u519B\u7528\u67AA\u652F\u51FA\u552E",
  "\u671F\u51FA\u552E\u624B\u67AA\u6C14\u67AA\u730E",
  "\u6781\u7AEF\u6B66\u529B\u519B\u54C1\u7F51",
  "\u6781\u7AEF\u6B66\u529B\u6298\u5200",
  "\u6781\u7AEF\u6B66\u529B\u76F4\u9500\u7F51",
  "\u6807\u51C6\u70B8\u5F39\u6559\u7A0B",
  "\u6838\u5F39\u5236\u4F5C\u65B9\u6CD5",
  "\u6838\u5F39\u5934\u7684\u5236\u9020",
  "\u6B63\u54C1\u519B\u523A\u51FA\u552E",
  "\u6C14\u67AA",
  "\u6C14\u67AA/\u51FA\u552E/\u4E13\u5356\u7F51",
  "\u6C14\u67AA/\u730E\u67AA/\u94A2\u73E0\u67AA",
  "\u6C14\u67AA\u4E13\u5356\u7F51",
  "\u6C14\u67AA\u4EF7\u683C \u4EFF\u771F\u6C14\u67AA",
  "\u6C14\u67AA\u4EF7\u683C\uFF0C\u6C14\u67AA\u4E13\u5356\u5E97",
  "\u6C14\u67AA\u4EFF\u771F\u67AA\u51FA\u552E",
  "\u6C14\u67AA\u730E\u67AA\u9EBB\u9189\u67AA",
  "\u6C14\u67AA\u770B\u8D27\u52A0QQ",
  "\u6C14\u67AA\u8054\u7CFBQQ",
  "\u6C14\u67AA\u8D27\u5230\u4ED8\u6B3E,\u6C7D\u72D7\u51FA\u552E",
  "\u6C14\u67AA\u8D2D\u4E70|\u6C14\u67AA\u7EC4\u88C5",
  "\u6C14\u67AA\u8FF7\u9B42\u836F",
  "\u6C14\u72D7 \u9AD8\u538B\u6C14\u67AA",
  "\u6C14\u72D7\u51FA\u552E \u8FDB\u53E3\u6C14\u72D7",
  "\u6C22\u5F39\u624B\u5DE5\u5236\u4F5C\u65B9\u6CD5",
  "\u6C34\u6D74\u6CD5\u5236TNT",
  "\u6C7D\u6CB9\u4E09\u5206\u4E4B\u4E00\u767D\u7CD6\u6DF7\u5408",
  "\u6C7D\u72D7\u9AD8\u538B\u6C7D\u67AA",
  "\u6C7D\u8F66\u70B8\u5F39\u5236\u4F5C",
  "\u6DB2\u4F53\u70B8\u836F\u914D\u65B9",
  "\u6DD8\u5B9D\u6C14\u67AA\u8D27\u5230\u4ED8\u6B3E",
  "\u706B\u836F\u5236\u4F5C\u7B80\u6613\u70B8\u5F39",
  "\u706B\u836F\u539F\u7406",
  "\u706B\u836F\u7684\u914D\u65B9",
  "\u706B\u836F\u914D\u65B9",
  "\u70B8\u5F39\u5236\u4F5C",
  "\u70B8\u5F39\u5236\u4F5C\u4ECE\u5165\u95E8",
  "\u70B8\u5F39\u5236\u4F5C\u4ECE\u5165\u95E8\u5230\u7CBE",
  "\u70B8\u5F39\u5236\u4F5C\u5165\u95E8",
  "\u70B8\u5F39\u5236\u4F5C\u624B\u518C \u786B\u9178",
  "\u70B8\u5F39\u914D\u65B9",
  "\u70B8\u836F",
  "\u70B8\u836F\u51FA\u552E",
  "\u70B8\u836F\u5236\u9020\u751F\u4EA7\u5DE5\u827A",
  "\u70B8\u836F\u53CA\u5176\u5236\u9020\u65B9\u6CD5",
  "\u70B8\u836F\u7684\u5236\u4F5C",
  "\u70B8\u836F\u7684\u5236\u4F5C\u914D\u65B9",
  "\u70B8\u836F\u7684\u6210\u5206",
  "\u70B8\u836F\u7684\u914D\u65B9",
  "\u70B8\u836F\u785D\u9178\u7518\u6CB9\u5236\u6CD5",
  "\u70B8\u836F\u914D\u65B9\u4E0E\u5236\u4F5C",
  "\u70ED\u6B66\u5668QQ",
  "\u71C3\u70E7\u5242\u7684\u7B80\u6613\u5236\u4F5C",
  "\u71C3\u70E7\u5242\u7684\u7B80\u6613\u5236\u5907",
  "\u71C3\u70E7\u5F39",
  "\u71C3\u70E7\u5F39 \u5236\u4F5C",
  "\u71C3\u70E7\u5F39\u5236\u4F5C",
  "\u71C3\u70E7\u5F39\u7684\u5236\u4F5C\u65B9",
  "\u71C3\u70E7\u5F39\u7684\u5236\u4F5C\u65B9\u6CD5",
  "\u71C3\u70E7\u74F6\u5236\u4F5C",
  "\u71C3\u70E7\u74F6\u7684\u5236\u4F5C\u65B9\u6CD5",
  "\u7206\u7834\u548C\u6740\u4F24\u71C3\u70E7\u5F39",
  "\u72E9\u730E\u5668\u6750\u5F13\u5F29",
  "\u72E9\u730E\u5668\u6750\u5F13\u5F29\u4E13\u5356",
  "\u72E9\u730E\u5F13\u5F29\u4E13\u5356",
  "\u72E9\u730E\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u72E9\u730E\u5F13\u5F29\u9EBB\u9189\u7BAD",
  "\u730E\u67AA|\u771F\u67AA",
  "\u730E\u67AA\u4E13\u5356\u5E97",
  "\u730E\u67AA\u4EFF\u771F\u67AAQQ",
  "\u730E\u67AA\u51FA\u552E/\u67AA",
  "\u730E\u67AA\u54EA\u91CC\u6709\u5356",
  "\u730E\u67AA\u5B50\u5F39\u5E95\u706B\u4E13\u5356",
  "\u730E\u67AA\u624B\u67AA\u4E70\u5356",
  "\u730E\u67AA\u9500\u552E\u624B\u67AA\u9500\u552E\u6C14\u67AA",
  "\u730E\u67AA\u9EBB\u9189\u67AA\u94A2\u73E0\u67AA",
  "\u7528\u706B\u836F\u6DF7\u5408\u5851\u6599",
  "\u76F4\u5200\u5315\u9996\u76F4\u9500\u7F51",
  "\u780D\u5200\u7CBE\u54C1\u6298\u5200\u4E13\u5356",
  "\u785D\u9178\u7518\u6CB9",
  "\u785D\u9178\u7518\u6CB9\u5236\u4F5C",
  "\u785D\u9178\u7518\u6CB9\u70B8\u5F39\u5236\u4F5C",
  "\u785D\u9178\u7518\u6CB9\u70B8\u5F39\u5236\u4F5C\u65B9\u6CD5",
  "\u785D\u9178\u7518\u6CB9\u70B8\u836F\u5236\u4F5C",
  "\u785D\u9178\u94F5\u7684\u7B80\u4FBF\u5236\u53D6\u65B9\u6CD5",
  "\u785D\u94F5\u70B8\u836F\u914D\u65B9",
  "\u79C1\u4EBA\u4FA6\u63A2",
  "\u79C1\u5BB6\u4FA6\u63A2",
  "\u79C3\u9E70\u6C14\u67AA\u8D27\u5230\u4ED8\u6B3E",
  "\u7B80\u6613\u539F\u5B50\u5F39\u6559\u7A0B",
  "\u7B80\u6613\u5927\u5A01\u529B\u70B8\u5F39",
  "\u7B80\u6613\u5BFC\u5F39\u5236\u4F5C",
  "\u7B80\u6613\u6838\u5F39\u5934\u7684\u5236\u9020",
  "\u7B80\u6613\u70B8\u5F39",
  "\u7B80\u6613\u70B8\u836F",
  "\u7B80\u6613\u71C3\u70E7\u5F39",
  "\u7EC4\u88C5\u624B\u67AA",
  "\u7F8E\u56FD\u519B\u5200\u51FA\u552E",
  "\u81EA\u5236\u624B\u5F29",
  "\u81EA\u5236\u624B\u67AA\u54EA\u91CC\u4E70",
  "\u81EA\u5236\u624B\u67AA\u54EA\u91CC\u6709\u5356",
  "\u81EA\u5236\u70B8\u836F\u65B9\u6CD5",
  "\u81EA\u5236\u70B8\u836F\u914D\u65B9",
  "\u81EA\u5236\u71C3\u70E7\u5F39",
  "\u81EA\u52A8\u8DF3\u5200\u4E13\u5356",
  "\u83AB\u6D1B\u6258\u592B\u71C3\u70E7\u5F39",
  "\u83AB\u6D1B\u6258\u592B\u9E21\u5C3E\u9152\u7684\u914D\u65B9",
  "\u8457\u540D\u7CBE\u54C1\u6298\u5200\u51FA\u552E",
  "\u897F\u70B9\u519B\u5200\u7F51",
  "\u897F\u70B9\u519B\u54C1\u519B\u5200\u7F51",
  "\u8B66\u7528\u5200\u5177\u51FA\u552E",
  "\u8C03\u67E5\u5A5A\u5916\u60C5",
  "\u8D2D\u4E70\u67AA\u652FQQ",
  "\u8D2D\u4E70\u81EA\u7206\u6750\u6599",
  "\u8D75\u6C0F\u5F13\u5F29\u4E13\u5356",
  "\u8D75\u6C0F\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u8D75\u6C0F\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u8D75\u6C0F\u5F13\u5F29\u9500\u552E",
  "\u8D77\u7206\u5668",
  "\u8F6C\u8BA9 \u730E\u67AA",
  "\u8F7B\u578B\u5DE1\u822A\u5BFC\u5F39\u7684\u5236\u4F5C",
  "\u8FDB\u53E3\u6C14\u67AA,\u6C14\u67AA\u5B50\u5F39",
  "\u8FFD\u98CE\u5F13\u5F29\u9EBB\u9189\u7BAD\u4E13\u5356",
  "\u90D1\u5DDE\u5F13\u5F29\u4E13\u5356",
  "\u9178\u7518\u6CB9\u70B8\u836F",
  "\u91CC\u6709\u6C7D\u67AA\u51FA\u552E",
  "\u91CE\u8425\u519B\u5200\u51FA\u552E",
  "\u91CE\u8425\u5200\u4E13\u5356",
  "\u91CE\u8425\u5200\u5177\u4E13\u5356",
  "\u91CE\u8425\u5200\u5177\u519B\u54C1\u7F51",
  "\u91CE\u8425\u5F00\u5C71\u5200\u519B\u523A",
  "\u91CE\u8425\u780D\u5200\u6237\u5916\u519B\u5200",
  "\u9488\u5B54\u6444\u8C61",
  "\u94A2\u73E0\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u94A2\u73E0\u5F13\u5F29\u4E13\u5356\u7F51",
  "\u94A2\u73E0\u67AA\u5C0F\u53E3\u5F84\u6B65\u67AA",
  "\u94C5\u5F39 \u4E0A\u6D77\u5DE5\u5B57\u6C14\u67AA",
  "\u9500\u552E/\u4E13\u5356/\u4E70\u535677\u5F0F\u624B\u67AA",
  "\u9500\u552E\u5C0F\u53E3\u5F84\u6B65\u67AA",
  "\u9500\u552E\u6C14\u624B\u72D7",
  "\u9500\u552E\u7535\u624B\u72D7",
  "\u9500\u552E\u8FD0\u52A8\u6B65\u67AA",
  "\u9521\u5CF0\u6C14\u67AA\u51FA\u552E",
  "\u957F\u671F\u51FA \u552E\u624B\u67AA",
  "\u9632\u536B\u5200\u5177\u4E13\u5356",
  "\u9632\u536B\u5200\u5177\u519B\u54C1\u7F51",
  "\u9632\u536B\u5200\u5177\u76F4\u9500\u7F51",
  "\u9632\u536B\u68CD\u5200\u51FA\u552E",
  "\u9632\u536B\u68CD\u5200\u6237\u5916\u5200\u5177",
  "\u9632\u536B\u7529\u68CD\u51FA\u552E",
  "\u9632\u536B\u7535\u68CD\u51FA\u552E",
  "\u9632\u536B\u8457\u540D\u519B\u5200\u51FA\u552E",
  "\u9632\u536B\u91CE\u8425\u780D\u5200\u51FA\u552E",
  "\u9632\u8EAB\u624B\u67AAQQ",
  "\u9632\u8EAB\u6B66\u5668\u624B\u67AA",
  "\u9633\u6C5F\u519B\u54C1\u519B\u5200\u7F51",
  "\u9633\u6C5F\u5200\u5177\u4E13\u5356",
  "\u9633\u6C5F\u5200\u5177\u519B\u54C1\u7F51",
  "\u9633\u6C5F\u5200\u5177\u6279\u53D1\u7F51",
  "\u9633\u6C5F\u5200\u5177\u76F4\u9500\u7F51",
  "\u963B\u51FB\u67AA/\u6C7D\u67AA/\u9AD8\u538B\u6C14\u67AA",
  "\u963F\u5170\u5F97\u9F99\u91CE\u8425\u5200\u5177\u7F51",
  "\u963F\u5170\u5FB7\u9F99\u6237\u5916",
  "\u963F\u5170\u5FB7\u9F99\u91CE\u8425\u5200",
  "\u96C6\u56E2\u51FA\u552E\u624B\u67AA",
  "\u96C6\u56E2\u51FA\u552E\u624B\u67AA\u6C14\u67AA",
  "\u96C6\u675F\u70B8\u5F39\u5236\u4F5C",
  "\u96F7\u7BA1\u51FA\u552E",
  "\u9AD8\u538B\u6C14\u67AA,\u6C14\u67AA\u5B50\u5F39",
  "\u9AD8\u538B\u6C14\u67AA|\u6C14\u67AA\u8D27\u5230\u4ED8\u6B3E",
  "\u9AD8\u538B\u6C14\u67AA|\u7535\u72D7\u4E13\u5356",
  "\u9AD8\u538B\u6C14\u67AA\u4E13\u5356\u5E97",
  "\u9AD8\u538B\u72D7QQ",
  "\u9AD8\u6027\u80FD\u7206\u70B8\u7269\u8D28\u6DF7\u5408",
  "\u9AD8\u7206\u70B8\u836F\u57FA\u672C\u914D\u65B9",
  "\u9AD8\u7206\u70B8\u836F\u7684\u57FA\u672C\u914D\u65B9",
  "\u9E21\u5C3E\u9152\u70B8\u5F39\u5236\u4F5C",
  "\u9EBB\u9189\u5F13\u5F29\u4E13\u5356\u5E97",
  "\u9EBB\u9189\u67AA\u51FA\u552E\u53EF\u9A8C\u8D27",
  "\u9EBB\u9189\u67AA\u730E\u67AA\u519B\u7528",
  "\u9ED1\u706B\u836F\u548C\u785D\u9178\u94BE\u519C\u836F\u6DF7\u5408",
  "\u9ED1\u706B\u836F\u6BD4\u4F8B",
  "\u9ED1\u706B\u836F\u7684\u5236\u4F5C",
  "\u9ED1\u706B\u836F\u7684\u6210\u5206",
  "\u9ED1\u706B\u836F\u7684\u914D\u65B9",
  "\u9ED1\u706B\u836F\u914D\u65B9",
  "\u9ED1\u706B\u836F\u914D\u65B9\u6BD4\u4F8B",
  "\u9ED1\u7D22\u91D1\u7684\u5236\u9020\u8FC7\u7A0B"
];

// api/_contentGuard.ts
var RISK_RULES = [
  {
    category: "political",
    words: [
      // 国家领导人姓名（现任及历史）
      "\u4E60\u8FD1\u5E73",
      "\u674E\u514B\u5F3A",
      "\u674E\u5F3A",
      "\u8D75\u4E50\u9645",
      "\u738B\u6CAA\u5B81",
      "\u8521\u5947",
      "\u4E01\u859B\u7965",
      "\u674E\u5E0C",
      "\u6BDB\u6CFD\u4E1C",
      "\u5468\u6069\u6765",
      "\u9093\u5C0F\u5E73",
      "\u6C5F\u6CFD\u6C11",
      "\u80E1\u9526\u6D9B",
      "\u6E29\u5BB6\u5B9D",
      "\u6731\u9555\u57FA",
      // 分裂国家 / 颠覆政权 / 邪教
      "\u98A0\u8986\u56FD\u5BB6",
      "\u5206\u88C2\u56FD\u5BB6",
      "\u717D\u52A8\u98A0\u8986",
      "\u85CF\u72EC",
      "\u7586\u72EC",
      "\u53F0\u72EC",
      "\u6E2F\u72EC",
      "\u6CD5\u8F6E\u529F",
      // 开源词库补充（领导人姓名变体 + 邪教）
      ...POLITICAL_WORDS
    ]
  },
  {
    category: "porn",
    words: [
      "\u8272\u60C5",
      "\u9EC4\u8272",
      "\u6DEB\u79FD",
      "\u88F8\u4F53",
      "\u88F8\u7167",
      "\u88F8\u804A",
      "\u6027\u4EA4",
      "\u6027\u7231",
      "\u505A\u7231",
      "\u5AD6\u5A3C",
      "\u5356\u6DEB",
      "\u62DB\u5AD6",
      "\u7EA6\u70AE",
      "\u8272\u60C5\u7247",
      "\u6BDB\u7247",
      "av\u5973\u4F18",
      // 开源词库补充（色情低俗）
      ...PORN_WORDS
    ]
  },
  {
    category: "violence",
    words: [
      "\u6050\u6016\u5206\u5B50",
      "\u6050\u6016\u4E3B\u4E49",
      "\u6050\u6016\u88AD\u51FB",
      "isis",
      "isil",
      "\u57FA\u5730\u7EC4\u7EC7",
      "\u672C\u62C9\u767B",
      "\u65A9\u9996",
      "\u8840\u8165",
      "\u5C60\u6740",
      "\u7206\u70B8\u88AD\u51FB",
      "\u81EA\u6740\u5F0F\u88AD\u51FB",
      "\u4EBA\u4F53\u70B8\u5F39"
    ]
  },
  {
    category: "illegal",
    words: [
      // 毒品
      "\u6BD2\u54C1",
      "\u51B0\u6BD2",
      "\u6D77\u6D1B\u56E0",
      "\u5927\u9EBB",
      "\u6447\u5934\u4E38",
      "\u53EF\u5361\u56E0",
      "\u5438\u6BD2",
      "\u8D29\u6BD2",
      "\u5236\u6BD2",
      // 赌博
      "\u8D4C\u535A",
      "\u535A\u5F69",
      "\u8D4C\u573A",
      "\u7F51\u8D4C",
      "\u516D\u5408\u5F69",
      // 诈骗 / 洗钱
      "\u8BC8\u9A97",
      "\u7535\u4FE1\u8BC8\u9A97",
      "\u6740\u732A\u76D8",
      "\u6D17\u94B1",
      // 枪支 / 爆炸物
      "\u67AA\u652F",
      "\u67AA\u68B0",
      "\u519B\u706B",
      "\u70B8\u836F",
      // 开源词库补充（涉枪涉爆 / 广告 / 贪腐）
      ...ILLEGAL_WORDS
    ]
  },
  {
    category: "forgery",
    words: [
      "\u4F2A\u9020\u8EAB\u4EFD\u8BC1",
      "\u4F2A\u9020\u516C\u7AE0",
      "\u4F2A\u9020\u516C\u6587",
      "\u4F2A\u9020\u8BC1\u4EF6",
      "\u5047\u8BC1",
      "\u529E\u8BC1",
      "\u4EE3\u5F00\u53D1\u7968"
    ]
  },
  {
    category: "official",
    words: [
      "\u5192\u5145\u8B66\u5BDF",
      "\u5192\u5145\u519B\u4EBA",
      "\u5192\u5145\u516C\u52A1\u5458",
      "\u5047\u8B66\u5BDF",
      "\u5047\u519B\u4EBA",
      "\u5047\u519B\u5B98\u8BC1",
      "\u8B66\u5BDF\u8BC1"
    ]
  }
];
var CATEGORY_LABELS = {
  political: "\u653F\u6CBB\u654F\u611F",
  porn: "\u8272\u60C5\u4F4E\u4FD7",
  violence: "\u66B4\u6050\u8840\u8165",
  illegal: "\u8FDD\u6CD5\u8FDD\u89C4",
  forgery: "\u4F2A\u9020\u516C\u6587\u8BC1\u4EF6",
  official: "\u519B\u8B66/\u56FD\u5BB6\u673A\u5173"
};
function normalize(text) {
  return text.toLowerCase().replace(/[\s\u3000\u00a0·•‧\-—_*~～|/\\@#$%^&+=、。，,;；:：!！?？'""''（）()\[\]【】{}<>《》「」『』【】]/g, "");
}
var NORMALIZED_RULES = RISK_RULES.map((rule) => ({
  ...rule,
  words: rule.words.map((w) => normalize(w)).filter((w) => w.length > 0)
}));
function checkContent(text) {
  if (!text) return { safe: true };
  const normalized = normalize(text);
  if (!normalized) return { safe: true };
  for (const rule of NORMALIZED_RULES) {
    for (const word of rule.words) {
      if (normalized.includes(word)) {
        return {
          safe: false,
          category: rule.category,
          categoryLabel: CATEGORY_LABELS[rule.category],
          matched: word
        };
      }
    }
  }
  return { safe: true };
}
function checkTextInputs(items) {
  for (const item of items) {
    const result = checkContent(item.value);
    if (!result.safe) {
      return { ...result, label: item.label };
    }
  }
  const combined = items.map((it) => (it.value || "").trim()).filter((v) => v.length > 0).join("");
  if (combined) {
    const result = checkContent(combined);
    if (!result.safe) {
      return { ...result, label: "\u591A\u4E2A\u6587\u5B57\u6846\u7EC4\u5408" };
    }
  }
  return { safe: true };
}
function getViolationMessage() {
  return "\u65E0\u6CD5\u5408\u6210\uFF0C\u8BF7\u68C0\u67E5\u6587\u5B57\u5408\u89C4\u6027";
}

// api/_app.ts
var MAX_UPLOAD_OPTIONS_PER_TEMPLATE = 10;
var MAX_IMAGE_DATAURL_LENGTH = 400 * 1024;
var SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var imageKey = (templateId, optionId) => `image:${templateId}:${optionId}`;
var bgKey = (templateId) => `bg:${templateId}`;
var MAX_BG_DATAURL_LENGTH = 6 * 1024 * 1024;
async function stripTemplateBackground(tpl, overwrite) {
  if (!tpl || typeof tpl.bgImageUrl !== "string" || !tpl.bgImageUrl.startsWith("data:image/")) {
    return tpl;
  }
  const dataUrl = tpl.bgImageUrl;
  const id = String(tpl.id || "");
  if (SAFE_ID_RE.test(id) && dataUrl.length <= MAX_BG_DATAURL_LENGTH) {
    if (overwrite || await readRaw(bgKey(id)) === null) {
      await writeRaw(bgKey(id), dataUrl);
    }
  }
  return { ...tpl, bgImageUrl: "" };
}
async function readBuiltinOverrides() {
  return readJson("builtin_overrides", { hiddenIds: [], deletedIds: [] });
}
async function readTemplateOrder() {
  const data = await readJson("template_order", { order: [] });
  return Array.isArray(data.order) ? data.order : [];
}
function initialAdminPassword() {
  const fromEnv = process.env.ADMIN_INITIAL_PASSWORD;
  if (fromEnv && fromEnv.trim().length >= 6) {
    return fromEnv.trim();
  }
  const random = crypto.randomBytes(9).toString("base64url");
  console.log(`[admin] \u672A\u914D\u7F6E ADMIN_INITIAL_PASSWORD \u73AF\u5883\u53D8\u91CF\uFF0C\u672C\u6B21 admin \u521D\u59CB\u5BC6\u7801\u4E3A\uFF1A${random}`);
  return random;
}
function defaultAdmins() {
  return [
    {
      username: "zhangxiyu",
      passwordHash: hashPassword("123456"),
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    },
    {
      username: "admin",
      passwordHash: hashPassword(initialAdminPassword()),
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    }
  ];
}
async function ensureSeedAdmins() {
  let admins = await readJson("admins", []);
  if (!Array.isArray(admins) || admins.length === 0) {
    await writeJson("admins", defaultAdmins());
    return;
  }
  const normalized = admins.map((a) => {
    const isZhang = a.username.trim().toLowerCase() === "zhangxiyu";
    return {
      ...a,
      role: isZhang ? "super_admin" : a.role || "admin",
      permissions: isZhang ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] } : a.permissions || { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false }
    };
  });
  if (!normalized.some((a) => a.username.trim().toLowerCase() === "zhangxiyu")) {
    normalized.unshift({
      username: "zhangxiyu",
      passwordHash: hashPassword("123456"),
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    });
  }
  if (JSON.stringify(normalized) !== JSON.stringify(admins)) {
    await writeJson("admins", normalized);
  }
}
async function getAdmins() {
  return readJson("admins", []);
}
var SCRYPT_N = 16384;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var SCRYPT_KEYLEN = 64;
var PASSWORD_MIN = 6;
var PASSWORD_MAX = 64;
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}
function verifyPassword(stored, input) {
  if (!stored || typeof stored !== "string") return { ok: false, legacy: false };
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) {
    return { ok: stored === input, legacy: true };
  }
  const [, nRaw, rRaw, pRaw, salt, expectedHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return { ok: false, legacy: false };
  }
  try {
    const actual = crypto.scryptSync(input, salt, SCRYPT_KEYLEN, { N, r, p });
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return { ok: false, legacy: false };
    return { ok: crypto.timingSafeEqual(actual, expected), legacy: false };
  } catch {
    return { ok: false, legacy: false };
  }
}
function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u4E3A ${PASSWORD_MIN} \u4F4D`;
  }
  if (password.length > PASSWORD_MAX) {
    return `\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u8D85\u8FC7 ${PASSWORD_MAX} \u4F4D`;
  }
  return null;
}
var TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var warnedNoSecret = false;
function getTokenSecret() {
  const fromEnv = process.env.ADMIN_TOKEN_SECRET;
  if (fromEnv) return fromEnv;
  if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.warn("[auth] ADMIN_TOKEN_SECRET \u672A\u8BBE\u7F6E\uFF0C\u4F7F\u7528\u8FDB\u7A0B\u7EA7\u968F\u673A\u5BC6\u94A5\uFF08\u91CD\u542F\u540E\u6240\u6709\u767B\u5F55\u4EE4\u724C\u5931\u6548\uFF09");
  }
  return getTokenSecret.tmpSecret ||= crypto.randomBytes(32).toString("hex");
}
function signToken(username, pv) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${exp}:${pv}`;
  const sig = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  const nameB64 = Buffer.from(username, "utf-8").toString("base64url");
  return `${sig}.${exp}.${nameB64}.${pv}`;
}
function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [sig, expRaw, nameB64, pvRaw] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  let username;
  try {
    username = Buffer.from(nameB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const pv = pvRaw !== void 0 ? Number(pvRaw) : null;
  if (pv !== null && (!Number.isInteger(pv) || pv < 0)) return null;
  const payload = pv === null ? `${username}:${exp}` : `${username}:${exp}:${pv}`;
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { username, pv };
}
function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.body && typeof req.body.token === "string" && req.body.token || null;
}
function requireAuth() {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      const claims = token ? verifyToken(token) : null;
      if (!claims) {
        console.log(
          `[auth] 401 \u62D2\u7EDD: ${req.method} ${req.path} | token: ${token ? `${String(token).slice(0, 16)}...` : "\u672A\u643A\u5E26"}`
        );
        return res.status(401).json({ error: "\u8BF7\u5148\u767B\u5F55\u540E\u518D\u64CD\u4F5C" });
      }
      const admins = await getAdmins();
      const found = admins.find(
        (a) => a.username.trim().toLowerCase() === claims.username.trim().toLowerCase()
      );
      if (!found) {
        return res.status(401).json({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
      }
      if (claims.pv !== null && claims.pv !== (found.pv ?? 0)) {
        return res.status(401).json({ error: "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF08\u5BC6\u7801\u5DF2\u4FEE\u6539\uFF09\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
      }
      req.adminUsername = found.username;
      req.admin = found;
      next();
    } catch (err) {
      next(err);
    }
  };
}
function requireSuperAdmin() {
  return async (req, res, next) => {
    const username = req.adminUsername;
    const admins = await getAdmins();
    const found = admins.find((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    const isSuper = username.trim().toLowerCase() === "zhangxiyu" || found?.role === "super_admin";
    if (!isSuper) {
      return res.status(403).json({ error: "\u53EA\u6709\u8D85\u7EA7\u7BA1\u7406\u5458\u53EF\u4EE5\u6267\u884C\u6B64\u64CD\u4F5C" });
    }
    next();
  };
}
function getTemplateAccess(user, tpl) {
  const name = user.username.trim().toLowerCase();
  const isSuper = name === "zhangxiyu" || user.role === "super_admin";
  const isSenior = user.role === "senior_admin";
  const owner = !tpl?.author || String(tpl.author).trim().toLowerCase() === name;
  const granted = (user.permissions?.allowedTemplateIds || []).includes(tpl?.id) || Array.isArray(tpl?.allowedEditors) && tpl.allowedEditors.some((u) => typeof u === "string" && u.trim().toLowerCase() === name);
  return {
    isSuper,
    // 编辑：超管/高级管理员/全局编辑他人权限/本人/被指定授权
    canEdit: isSuper || isSenior || user.permissions?.canEditOthers === true || owner || granted,
    // 上线/下架：超管/高级管理员/全局发布他人权限；本人或被指定授权的模板还需独立 canPublish 授权
    canPublish: isSuper || isSenior || user.permissions?.canPublishOthers === true || (owner || granted) && user.permissions?.canPublish === true,
    // 删除：超管/高级管理员/全局删除他人权限/本人（被指定授权不含删除，与前端一致）
    canDelete: isSuper || isSenior || user.permissions?.canDeleteOthers === true || owner
  };
}
function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function sanitizeAdmin(a) {
  const isSuper = a.username.trim().toLowerCase() === "zhangxiyu" || a.role === "super_admin";
  return {
    username: a.username,
    role: isSuper ? "super_admin" : a.role || "admin",
    permissions: isSuper ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] } : {
      canEditOthers: a.permissions?.canEditOthers ?? false,
      canPublishOthers: a.permissions?.canPublishOthers ?? false,
      canDeleteOthers: a.permissions?.canDeleteOthers ?? false,
      allowedTemplateIds: a.permissions?.allowedTemplateIds || []
    },
    createdAt: a.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function createApp() {
  const app = express();
  await ensureSeedAdmins();
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use((req, res, next) => {
    const accept = String(req.headers["accept-encoding"] || "").toLowerCase();
    if (!accept.includes("gzip")) return next();
    const origJson = res.json.bind(res);
    res.json = ((body) => {
      const payload = Buffer.from(JSON.stringify(body), "utf-8");
      if (payload.length < 1024) {
        return origJson(body);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      zlib.gzip(payload, (err, buf) => {
        if (err) {
          res.removeHeader("Content-Encoding");
          res.end(payload);
        } else {
          res.end(buf);
        }
      });
      return res;
    });
    next();
  });
  app.post("/api/admin/login", ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u7528\u6237\u540D/\u90AE\u7BB1\u4E0E\u5BC6\u7801" });
    }
    const admins = await getAdmins();
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    const check = found ? verifyPassword(found.passwordHash, password) : { ok: false, legacy: false };
    if (!found || !check.ok) {
      return res.status(401).json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5" });
    }
    if (check.legacy) {
      found.passwordHash = hashPassword(password);
      found.pv = 0;
      await writeJson("admins", admins);
    }
    const sanitized = sanitizeAdmin(found);
    const token = signToken(found.username, found.pv ?? 0);
    return res.json({
      success: true,
      token,
      admin: sanitized,
      message: "\u767B\u5F55\u6210\u529F"
    });
  }));
  app.post("/api/admin/register", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }
    const admins = await getAdmins();
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55" });
    }
    const newAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false, allowedTemplateIds: [] },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    };
    admins.push(newAdmin);
    await writeJson("admins", admins);
    return res.json({
      success: true,
      token: signToken(newAdmin.username, 0),
      admin: sanitizeAdmin(newAdmin),
      message: "\u7BA1\u7406\u5458\u8D26\u53F7\u6CE8\u518C\u6210\u529F\uFF01"
    });
  }));
  app.get("/api/admin/users", requireAuth(), ah(async (_req, res) => {
    const admins = await getAdmins();
    return res.json({ success: true, users: admins.map(sanitizeAdmin) });
  }));
  app.post("/api/admin/users/update-role", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, role, permissions } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const isZhangxiyu = targetUsername.trim().toLowerCase() === "zhangxiyu";
    const finalRole = isZhangxiyu ? "super_admin" : role || "admin";
    const existingPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: []
    };
    const finalPermissions = finalRole === "super_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: existingPerms.allowedTemplateIds || [] } : finalRole === "senior_admin" ? {
      canEditOthers: permissions?.canEditOthers ?? true,
      canPublishOthers: permissions?.canPublishOthers ?? true,
      canDeleteOthers: permissions?.canDeleteOthers ?? true,
      canPublish: permissions?.canPublish ?? true,
      allowedTemplateIds: permissions?.allowedTemplateIds !== void 0 ? permissions.allowedTemplateIds : existingPerms.allowedTemplateIds || []
    } : {
      canEditOthers: permissions?.canEditOthers ?? false,
      canPublishOthers: permissions?.canPublishOthers ?? false,
      canDeleteOthers: permissions?.canDeleteOthers ?? false,
      canPublish: permissions?.canPublish ?? false,
      allowedTemplateIds: permissions?.allowedTemplateIds !== void 0 ? permissions.allowedTemplateIds : existingPerms.allowedTemplateIds || []
    };
    admins[targetIdx] = { ...admins[targetIdx], role: finalRole, permissions: finalPermissions };
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u66F4\u65B0\u7BA1\u7406\u5458\u300C${targetUsername}\u300D\u7684\u6743\u9650\u914D\u7F6E\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.post("/api/admin/users/assign-templates", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, templateIds } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const currentPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: []
    };
    admins[targetIdx].permissions = {
      ...currentPerms,
      allowedTemplateIds: Array.isArray(templateIds) ? templateIds : []
    };
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u4E3A\u300C${targetUsername}\u300D\u5206\u914D ${Array.isArray(templateIds) ? templateIds.length : 0} \u4E2A\u6307\u5B9A\u6A21\u677F\u6743\u9650\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.post("/api/admin/users/create", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u4E0E\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }
    const admins = await getAdmins();
    if (admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728" });
    }
    const targetRole = role || "admin";
    const newAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: targetRole,
      permissions: targetRole === "senior_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true } : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    };
    admins.push(newAdmin);
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u521B\u5EFA\u65B0\u7BA1\u7406\u5458\u300C${username}\u300D\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.delete("/api/admin/users/:username", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    if (username.trim().toLowerCase() === "zhangxiyu") {
      return res.status(403).json({ error: "\u8D85\u7EA7\u7BA1\u7406\u5458 zhangxiyu \u65E0\u6CD5\u88AB\u5220\u9664" });
    }
    let admins = await getAdmins();
    const beforeLen = admins.length;
    admins = admins.filter((a) => a.username.trim().toLowerCase() !== username.trim().toLowerCase());
    if (admins.length === beforeLen) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458" });
    }
    await writeJson("admins", admins);
    return res.json({ success: true, message: "\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5220\u9664", users: admins.map(sanitizeAdmin) });
  }));
  app.post("/api/admin/change-password", requireAuth(), ah(async (req, res) => {
    const username = req.adminUsername;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u5F53\u524D\u5BC6\u7801\u4E0E\u65B0\u5BC6\u7801" });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(401).json({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
    }
    const check = verifyPassword(admins[idx].passwordHash, oldPassword);
    if (!check.ok) {
      return res.status(400).json({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" });
    }
    const invalidNew = validateNewPassword(newPassword);
    if (invalidNew) {
      return res.status(400).json({ error: invalidNew });
    }
    if (newPassword === oldPassword) {
      return res.status(400).json({ error: "\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C" });
    }
    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({ success: true, message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
  }));
  app.post("/api/admin/users/reset-password", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const invalidNew = validateNewPassword(newPassword);
    if (invalidNew) {
      return res.status(400).json({ error: invalidNew });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({ success: true, message: `\u5DF2\u91CD\u7F6E\u7BA1\u7406\u5458\u300C${admins[idx].username}\u300D\u7684\u5BC6\u7801` });
  }));
  app.post("/api/admin/users/reset-password-default", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const newPwd = initialAdminPassword();
    admins[idx].passwordHash = hashPassword(newPwd);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u5C06\u7BA1\u7406\u5458\u300C${admins[idx].username}\u300D\u7684\u5BC6\u7801\u521D\u59CB\u5316\u4E3A\uFF1A${newPwd}`
    });
  }));
  app.post("/api/check-content", ah(async (req, res) => {
    const items = req.body && Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "\u53C2\u6570\u9519\u8BEF\uFF1Aitems \u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const normalized = items.map((it) => {
      const obj = it && typeof it === "object" ? it : {};
      return {
        label: typeof obj.label === "string" ? obj.label : "",
        value: typeof obj.value === "string" ? obj.value : ""
      };
    });
    const result = checkTextInputs(normalized);
    if (!result.safe) {
      console.warn(
        `[content-guard] \u62E6\u622A\uFF08${result.categoryLabel || result.category}${result.label ? " / " + result.label : ""}\uFF09`
      );
      return res.status(400).json({
        success: false,
        message: getViolationMessage(),
        category: result.category,
        categoryLabel: result.categoryLabel,
        label: result.label
      });
    }
    return res.json({ success: true });
  }));
  app.get("/api/templates", ah(async (_req, res) => {
    const raw = await readJson("diy_templates", []);
    const templates = [];
    let migrated = false;
    for (const t of raw) {
      if (t && typeof t.bgImageUrl === "string" && t.bgImageUrl.startsWith("data:image/")) {
        templates.push(await stripTemplateBackground(t, false));
        migrated = true;
      } else {
        templates.push(t);
      }
    }
    if (migrated) {
      await writeJson("diy_templates", templates);
    }
    const overrides = await readBuiltinOverrides();
    const order = await readTemplateOrder();
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    res.json({ success: true, templates, overrides, order });
  }));
  app.get("/api/templates/share/:id", ah(async (req, res) => {
    const { id } = req.params;
    const notFound = () => res.status(404).json({ success: false, message: "\u8BE5\u6A21\u677F\u672A\u4E0A\u7EBF\u6216\u4E0D\u5B58\u5728" });
    if (!SAFE_ID_RE.test(id)) return notFound();
    const diyTemplates = await readJson("diy_templates", []);
    let tpl = diyTemplates.find((t) => t.id === id);
    if (tpl) {
      if (tpl.isPublished === false) return notFound();
      tpl = await stripTemplateBackground(tpl, false);
    } else {
      const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id);
      if (!builtin) return notFound();
      const overrides = await readBuiltinOverrides();
      if (builtin.isPublished === false || overrides.hiddenIds.includes(id) || overrides.deletedIds.includes(id)) {
        return notFound();
      }
      tpl = builtin;
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    return res.json({ success: true, template: tpl });
  }));
  app.post("/api/template-order", requireAuth(), ah(async (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      return res.status(400).json({ error: "\u6392\u5E8F\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E" });
    }
    await writeJson("template_order", { order });
    return res.json({ success: true, order, message: "\u6A21\u677F\u6392\u5E8F\u5DF2\u4FDD\u5B58" });
  }));
  app.post("/api/templates/builtin-state", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { id, hidden, deleted } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "\u6A21\u677F ID \u4E0D\u80FD\u4E3A\u7A7A" });
    }
    if (!BUILTIN_TEMPLATES.some((b) => b.id === id)) {
      return res.status(400).json({ error: "\u8BE5\u6A21\u677F\u4E0D\u662F\u5185\u7F6E\u6A21\u677F\uFF0C\u8BF7\u901A\u8FC7\u6A21\u677F\u5E93\u5E38\u89C4\u6D41\u7A0B\u5220\u9664\u6216\u4E0B\u67B6\u3002" });
    }
    const overrides = await readBuiltinOverrides();
    const diyTemplates = await readJson("diy_templates", []);
    if (deleted === true) {
      const remaining = BUILTIN_TEMPLATES.filter((b) => b.id !== id && !overrides.deletedIds.includes(b.id)).length + diyTemplates.length;
      if (remaining < 1) {
        return res.status(400).json({
          error: "\u6A21\u677F\u5E93\u4EC5\u5269\u6700\u540E\u4E00\u4E2A\u6A21\u677F\uFF0C\u65E0\u6CD5\u5220\u9664\u3002\u8BF7\u5148\u521B\u5EFA\u6216\u53D1\u5E03\u5176\u4ED6\u6A21\u677F\u540E\u518D\u64CD\u4F5C\u3002"
        });
      }
      if (!overrides.deletedIds.includes(id)) {
        overrides.deletedIds.push(id);
      }
      overrides.hiddenIds = overrides.hiddenIds.filter((h) => h !== id);
    } else if (hidden !== void 0) {
      const publishedBuiltins = BUILTIN_TEMPLATES.filter(
        (b) => !overrides.hiddenIds.includes(b.id) && !overrides.deletedIds.includes(b.id) && b.isPublished !== false
      );
      const publishedDiy = diyTemplates.filter((t) => t.isPublished !== false).length;
      const remainingPublished = publishedBuiltins.filter((b) => b.id !== id).length + publishedDiy;
      if (hidden === true && remainingPublished < 1) {
        return res.status(400).json({
          error: "\u6A21\u677F\u5E93\u4E2D\u4EC5\u5269\u6700\u540E\u4E00\u4E2A\u5DF2\u53D1\u5E03\u6A21\u677F\uFF0C\u65E0\u6CD5\u4E0B\u67B6\u3002\u8BF7\u5148\u53D1\u5E03\u5176\u4ED6\u6A21\u677F\u540E\u518D\u64CD\u4F5C\u3002"
        });
      }
      if (hidden === true) {
        if (!overrides.hiddenIds.includes(id)) {
          overrides.hiddenIds.push(id);
        }
      } else {
        overrides.hiddenIds = overrides.hiddenIds.filter((h) => h !== id);
      }
    }
    await writeJson("builtin_overrides", overrides);
    return res.json({ success: true, overrides });
  }));
  app.post("/api/templates", requireAuth(), ah(async (req, res) => {
    const newTemplate = req.body;
    if (!newTemplate || !newTemplate.name) {
      return res.status(400).json({ error: "\u6A21\u677F\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u7F3A\u5C11\u6A21\u677F\u540D\u79F0" });
    }
    const rawOptions = Array.isArray(newTemplate.imageOptions) ? newTemplate.imageOptions : [];
    const uploadCount = rawOptions.filter((o) => o && o.source === "upload").length;
    if (uploadCount > MAX_UPLOAD_OPTIONS_PER_TEMPLATE) {
      return res.status(400).json({
        error: `\u4E0A\u4F20\u578B\u56FE\u7247\u9009\u9879\u6700\u591A ${MAX_UPLOAD_OPTIONS_PER_TEMPLATE} \u5F20\uFF0C\u5F53\u524D ${uploadCount} \u5F20`
      });
    }
    const imageOptions = rawOptions.filter((o) => o && typeof o.id === "string").map((o) => {
      const clean = {
        id: o.id,
        label: typeof o.label === "string" ? o.label : "\u56FE\u7247",
        source: o.source === "url" ? "url" : "upload"
      };
      if (clean.source === "url" && typeof o.url === "string") {
        clean.url = o.url;
      }
      return clean;
    });
    const templates = await readJson("diy_templates", []);
    const templateId = newTemplate.id || `diy-template-${Date.now()}`;
    const existingIndex = templates.findIndex((t) => t.id === templateId);
    const existing = existingIndex >= 0 ? templates[existingIndex] : null;
    const me = req.admin;
    const prepared = {
      ...newTemplate,
      imageOptions,
      id: templateId,
      author: existing ? existing.author : me.username,
      allowedEditors: existing ? existing.allowedEditors : Array.isArray(newTemplate.allowedEditors) ? newTemplate.allowedEditors : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: newTemplate.createdAt || existing?.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    const access = getTemplateAccess(me, prepared);
    if (!access.canEdit) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u7F16\u8F91\u8BE5\u6A21\u677F\uFF08\u4EC5\u672C\u4EBA\u3001\u88AB\u6307\u5B9A\u6388\u6743\u6216\u5DF2\u5F00\u901A\u5168\u5C40\u7F16\u8F91\u6743\u9650\u7684\u7BA1\u7406\u5458\u53EF\u7F16\u8F91\uFF09" });
    }
    const payloadPublish = typeof newTemplate.isPublished === "boolean" ? newTemplate.isPublished : existing ? existing.isPublished !== false : false;
    const publishChanged = existing ? payloadPublish !== (existing.isPublished !== false) : payloadPublish === true;
    if (publishChanged && !access.canPublish) {
      return res.status(403).json({ error: "\u65E0\u4E0A\u7EBF\u6743\u9650\uFF1A\u4E0A\u7EBF/\u4E0B\u67B6\u6A21\u677F\u9700\u8D85\u7BA1\u5728\u6743\u9650\u914D\u7F6E\u4E2D\u5FC3\u6388\u4E88\u300C\u4E0A\u7EBF\u6A21\u677F\u300D\u6743\u9650" });
    }
    const cleaned = await stripTemplateBackground(prepared, true);
    if (prepared.bgType !== "image" && SAFE_ID_RE.test(templateId)) {
      await deleteRaw(bgKey(templateId));
    }
    if (existingIndex >= 0) {
      templates[existingIndex] = cleaned;
    } else {
      templates.unshift(cleaned);
    }
    await writeJson("diy_templates", templates);
    return res.json({ success: true, template: cleaned, message: "\u6A21\u677F\u5DF2\u4FDD\u5B58\u6210\u529F\uFF01" });
  }));
  app.delete("/api/templates/:id", requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    let templates = await readJson("diy_templates", []);
    const target = templates.find((t) => t.id === id);
    const me = req.admin;
    if (target && !getTemplateAccess(me, target).canDelete) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u5220\u9664\u8BE5\u6A21\u677F\uFF08\u4EC5\u672C\u4EBA\u3001\u8D85\u7BA1\u6216\u5DF2\u5F00\u901A\u5168\u5C40\u5220\u9664\u6743\u9650\u7684\u7BA1\u7406\u5458\u53EF\u5220\u9664\uFF09" });
    }
    const beforeLen = templates.length;
    templates = templates.filter((t) => t.id !== id);
    if (templates.length === beforeLen) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F\u6216\u65E0\u6CD5\u5220\u9664" });
    }
    await writeJson("diy_templates", templates);
    const uploadIds = Array.isArray(target?.imageOptions) ? target.imageOptions.filter((o) => o && o.source === "upload" && typeof o.id === "string").map((o) => o.id) : [];
    for (const optionId of uploadIds) {
      if (SAFE_ID_RE.test(optionId)) {
        await deleteRaw(imageKey(id, optionId));
      }
    }
    if (SAFE_ID_RE.test(id)) {
      await deleteRaw(bgKey(id));
    }
    return res.json({ success: true, message: "\u6A21\u677F\u5DF2\u6210\u529F\u5220\u9664" });
  }));
  app.get("/api/templates/:id/images", ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const diyTemplates = await readJson("diy_templates", []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F" });
    }
    const uploadOptions = (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : []).filter((o) => o && o.source === "upload" && typeof o.id === "string");
    const keys = uploadOptions.map((o) => imageKey(id, o.id));
    const rawMap = await mgetRaw(keys);
    const images = {};
    for (const optionId of uploadOptions.map((o) => o.id)) {
      const v = rawMap[imageKey(id, optionId)];
      if (typeof v === "string") {
        images[optionId] = v;
      }
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=300");
    return res.json({ success: true, images });
  }));
  app.get("/api/templates/:id/bg", ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const diyTemplates = await readJson("diy_templates", []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F" });
    }
    const bg = await readRaw(bgKey(id));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=300");
    return res.json({ success: true, bg });
  }));
  app.post("/api/templates/:id/images", requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const templates = await readJson("diy_templates", []);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F\uFF08\u4EC5\u81EA\u5B9A\u4E49\u6A21\u677F\u652F\u6301\u56FE\u7247\u4E0A\u4F20\uFF09" });
    }
    const me = req.admin;
    if (!getTemplateAccess(me, tpl).canEdit) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u7F16\u8F91\u8BE5\u6A21\u677F\u7684\u56FE\u7247\u9009\u9879" });
    }
    const uploadIds = new Set(
      (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : []).filter((o) => o && o.source === "upload" && typeof o.id === "string").map((o) => o.id)
    );
    const images = req.body && typeof req.body.images === "object" && req.body.images !== null ? req.body.images : {};
    const deleteIds = Array.isArray(req.body?.deleteIds) ? req.body.deleteIds : [];
    let saved = 0;
    const errors = [];
    for (const [optionId, dataUrl] of Object.entries(images)) {
      if (!SAFE_ID_RE.test(optionId)) {
        errors.push(`\u975E\u6CD5\u9009\u9879 ID: ${optionId}`);
        continue;
      }
      if (!uploadIds.has(optionId)) {
        errors.push(`\u9009\u9879 ${optionId} \u4E0D\u5C5E\u4E8E\u8BE5\u6A21\u677F`);
        continue;
      }
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/") || dataUrl.length > MAX_IMAGE_DATAURL_LENGTH) {
        errors.push(`\u9009\u9879 ${optionId} \u56FE\u7247\u6570\u636E\u65E0\u6548\u6216\u8D85\u8FC7 ${Math.round(MAX_IMAGE_DATAURL_LENGTH / 1024)}KB \u9650\u5236`);
        continue;
      }
      await writeRaw(imageKey(id, optionId), dataUrl);
      saved++;
    }
    let removed = 0;
    for (const optionId of deleteIds) {
      if (typeof optionId !== "string" || !SAFE_ID_RE.test(optionId)) continue;
      await deleteRaw(imageKey(id, optionId));
      removed++;
    }
    return res.json({ success: true, saved, removed, errors });
  }));
  app.post("/api/templates/assign-editors", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { templateId, allowedEditors } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: "templateId \u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const templates = await readJson("diy_templates", []);
    const idx = templates.findIndex((t) => t.id === templateId);
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u6A21\u677F" });
    }
    templates[idx] = {
      ...templates[idx],
      allowedEditors: Array.isArray(allowedEditors) ? allowedEditors : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeJson("diy_templates", templates);
    return res.json({
      success: true,
      message: `\u5DF2\u66F4\u65B0\u6A21\u677F\u300C${templates[idx].name}\u300D\u7684\u6307\u5B9A\u6388\u6743\u7BA1\u7406\u5458\u5217\u8868\uFF01`,
      template: templates[idx],
      templates
    });
  }));
  app.use((err, _req, res, _next) => {
    console.error("[api] Unhandled error:", err);
    return res.status(500).json({ error: "\u670D\u52A1\u5668\u5F00\u5C0F\u5DEE\u4E86\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
  });
  return app;
}

// api/_handler.ts
var appPromise = createApp();
function handler(req, res) {
  return appPromise.then((app) => app(req, res));
}
export {
  handler as default
};
