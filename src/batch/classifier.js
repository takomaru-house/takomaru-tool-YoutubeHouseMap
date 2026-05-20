// チャンネル属性分類器
// チャンネル名キーワードで「company（企業/公式）」or「individual（個人）」を判定。
// 多層判定:
//   1. overrides 最優先
//   2. 個人除外キーワード一致 → individual（「マイホーム」等を含む個人vlogger優先）
//   3. 強企業キーワード一致 → company
//   4. 弱企業キーワード一致 → company
//   5. デフォルト → individual

// 「これを含めばほぼ確実に企業」キーワード（大文字英語は case-sensitive で語彙判定）
const STRONG_COMPANY_KEYWORDS = [
  // 公式系
  '公式',
  '株式会社',
  '(株)',
  '㈱',
  '有限会社',
  '(有)',
  '合同会社',
  '(合)',
  // 業者系
  '工務店',
  'ハウスメーカー',
  '住宅メーカー',
  'ホームビルダー',
  '建築事務所',
  '建築士事務所',
  '一級建築士事務所',
  '二級建築士事務所',
  '設計事務所',
  '建設',
  '建材',
  '不動産',
  '住宅展示',
  '住宅相談所',
  '家具',
  '工房',
  '注文住宅専門',
  '家づくり専門',
  '建売',
  '専門店',
  // 職業系（プロを名乗っている）
  '建築家',
  '設計士',
  '社長',
  '店長',
  '専門家',
  // 業務系
  '住宅',
  '建築',
  'リフォーム',
  'スタジオ',
  '教室',
  'コンサル',
  'デザイン事務所',
  // 大文字英語（小文字は個人vlogger名のSORAHhouse等を巻き込むため case-sensitive で大文字のみ）
  'HOMES',
  'HOME',
  'HOUSE',
  'HOUSING',
];

// 「これを含めばほぼ確実に個人 vlogger」キーワード（弱企業判定を打ち消す）
const STRONG_INDIVIDUAL_KEYWORDS = [
  'マイホーム',
  'のおうち',
  'ちゃんねる',
  'ルームツアー',
  'のいえ',
  '4kids',
  '我が家',
  'vlog',
  'Vlog',
];

// 「含めばたぶん企業（個人除外に該当しなければ）」弱キーワード
const WEAK_COMPANY_KEYWORDS = [
  'ホーム',
  'ハウス',
  'ハウジング',
];

const COMPANY_KEYWORDS_CASE_INSENSITIVE = [
  'official',
  'home builder',
];

const includesAny = (text, keywords) => keywords.some((kw) => text.includes(kw));

const classifyChannel = (channelName, overrides) => {
  if (typeof channelName !== 'string' || channelName.length === 0) {
    return 'individual';
  }
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, channelName)) {
    const v = overrides[channelName];
    if (v === 'company' || v === 'individual') return v;
  }

  // 個人除外キーワード一致 → individual（最優先で「マイホーム」等の個人vloggerを catch）
  if (includesAny(channelName, STRONG_INDIVIDUAL_KEYWORDS)) return 'individual';

  // 強企業キーワード一致 → company
  if (includesAny(channelName, STRONG_COMPANY_KEYWORDS)) return 'company';

  // 大文字英語ブランド
  const lower = channelName.toLowerCase();
  if (includesAny(lower, COMPANY_KEYWORDS_CASE_INSENSITIVE)) return 'company';

  // 弱企業キーワード一致 → company
  if (includesAny(channelName, WEAK_COMPANY_KEYWORDS)) return 'company';

  // デフォルト
  return 'individual';
};

const categoryIdFor = (channelName, overrides) =>
  classifyChannel(channelName, overrides) === 'company' ? 'CAT-02' : 'CAT-01';

module.exports = {
  classifyChannel,
  categoryIdFor,
  STRONG_COMPANY_KEYWORDS,
  STRONG_INDIVIDUAL_KEYWORDS,
  WEAK_COMPANY_KEYWORDS,
};
