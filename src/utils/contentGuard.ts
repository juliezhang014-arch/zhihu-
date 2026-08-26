// 内容安全检测（前端 + 后端共用同一套词库与检测逻辑）。
//
// 定位：对「文字框输入」这类平台可控的文字做输入侧过滤。
// 命中即拒绝合成/生成，统一话术见 getViolationMessage()。
//
// 说明：本词库为「词面直写」级拦截（含去除空格/常见规避分隔符后的变体），
// 无法覆盖谐音、拆字、拼音缩写等语义级规避 —— 如需语义级精准需接云内容安全 API。

import { POLITICAL_WORDS, PORN_WORDS, ILLEGAL_WORDS } from '../data/sensitiveWords';

export type RiskCategory =
  | 'political' // 政治敏感
  | 'porn' // 色情低俗
  | 'violence' // 暴恐血腥
  | 'illegal' // 违法违规（毒品/赌博/诈骗/枪支等）
  | 'forgery' // 伪造公文证件
  | 'official'; // 军警/国家机关冒充

export interface RiskRule {
  category: RiskCategory;
  words: string[];
}

// 敏感词库（可扩展）。所有词统一小写、无空格，检测前会做同样归一化。
export const RISK_RULES: RiskRule[] = [
  {
    category: 'political',
    words: [
      // 国家领导人姓名（现任及历史）
      '习近平', '李克强', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希',
      '毛泽东', '周恩来', '邓小平', '江泽民', '胡锦涛', '温家宝', '朱镕基',
      // 分裂国家 / 颠覆政权 / 邪教
      '颠覆国家', '分裂国家', '煽动颠覆', '藏独', '疆独', '台独', '港独', '法轮功',
      // 开源词库补充（领导人姓名变体 + 邪教）
      ...POLITICAL_WORDS,
    ],
  },
  {
    category: 'porn',
    words: [
      '色情', '黄色', '淫秽', '裸体', '裸照', '裸聊', '性交', '性爱', '做爱',
      '嫖娼', '卖淫', '招嫖', '约炮', '色情片', '毛片', 'av女优',
      // 开源词库补充（色情低俗）
      ...PORN_WORDS,
    ],
  },
  {
    category: 'violence',
    words: [
      '恐怖分子', '恐怖主义', '恐怖袭击', 'isis', 'isil', '基地组织', '本拉登',
      '斩首', '血腥', '屠杀', '爆炸袭击', '自杀式袭击', '人体炸弹',
    ],
  },
  {
    category: 'illegal',
    words: [
      // 毒品
      '毒品', '冰毒', '海洛因', '大麻', '摇头丸', '可卡因', '吸毒', '贩毒', '制毒',
      // 赌博
      '赌博', '博彩', '赌场', '网赌', '六合彩',
      // 诈骗 / 洗钱
      '诈骗', '电信诈骗', '杀猪盘', '洗钱',
      // 枪支 / 爆炸物
      '枪支', '枪械', '军火', '炸药',
      // 开源词库补充（涉枪涉爆 / 广告 / 贪腐）
      ...ILLEGAL_WORDS,
    ],
  },
  {
    category: 'forgery',
    words: [
      '伪造身份证', '伪造公章', '伪造公文', '伪造证件', '假证', '办证', '代开发票',
    ],
  },
  {
    category: 'official',
    words: [
      '冒充警察', '冒充军人', '冒充公务员', '假警察', '假军人', '假军官证', '警察证',
    ],
  },
];

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  political: '政治敏感',
  porn: '色情低俗',
  violence: '暴恐血腥',
  illegal: '违法违规',
  forgery: '伪造公文证件',
  official: '军警/国家机关',
};

export interface Violation {
  safe: boolean;
  category?: RiskCategory;
  categoryLabel?: string;
  matched?: string;
}

// 归一化：小写化，并去除空格与常见规避分隔符（标点、星号、下划线等）。
// 用于对抗「用空格/符号隔开敏感词」的词面规避（如「习 近 平」→「习近平」）。
function normalize(text: string): string {
  return text
    .toLowerCase()
    // eslint-disable-next-line no-useless-escape
    .replace(/[\s\u3000\u00a0·•‧\-—_*~～|/\\@#$%^&+=、。，,;；:：!！?？'""''（）()\[\]【】{}<>《》「」『』【】]/g, '');
}

// 预计算：模块加载时对词库做一次归一化，检测时直接 includes（避免每次检测重复归一化上千词）
const NORMALIZED_RULES: RiskRule[] = RISK_RULES.map((rule) => ({
  ...rule,
  words: rule.words.map((w) => normalize(w)).filter((w) => w.length > 0),
}));

// 检测单段文字；命中返回首个违规项，否则 { safe: true }
export function checkContent(text: string): Violation {
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
          matched: word,
        };
      }
    }
  }
  return { safe: true };
}

// 批量检测文字框输入：返回第一个违规的文字框（附 label 便于定位提示）
export interface TextInputItem {
  label: string;
  value: string;
}

export function checkTextInputs(items: TextInputItem[]): (Violation & { label?: string }) {
  for (const item of items) {
    const result = checkContent(item.value);
    if (!result.safe) {
      return { ...result, label: item.label };
    }
  }
  return { safe: true };
}

// 统一拦截话术（前端弹窗 / 后端拒绝共用）
export function getViolationMessage(): string {
  return '无法合成，请检查文字合规性';
}
