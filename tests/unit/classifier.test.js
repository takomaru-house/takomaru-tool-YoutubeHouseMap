const { classifyChannel, categoryIdFor } = require('../../src/batch/classifier');

describe('classifyChannel() — 強企業キーワード', () => {
  test('UT-07-01: 「公式」を含むチャンネルは company', () => {
    expect(classifyChannel('【公式】東宝ホーム家づくりチャンネル')).toBe('company');
    expect(classifyChannel('カリモク家具｜公式チャンネル')).toBe('company');
  });

  test('UT-07-02: 「工務店」「ハウスメーカー」を含むチャンネルは company', () => {
    expect(classifyChannel('職人社長の家づくり工務店')).toBe('company');
    expect(classifyChannel('まかろにお【工務店&ハウスメーカー攻略法】')).toBe('company');
    expect(classifyChannel('岡谷工務店 大工のけんチャンネル')).toBe('company');
  });

  test('UT-07-03: 「株式会社」「(株)」「有限会社」を含むチャンネルは company', () => {
    expect(classifyChannel('建売新築を買うなら【株式会社おるすま】')).toBe('company');
    expect(classifyChannel('(株)CRLOWN 栃木県のリフォーム屋さん')).toBe('company');
  });

  test('UT-07-04: 「建築士事務所」「設計事務所」「一級建築士事務所」は company', () => {
    expect(classifyChannel('【公式】コラボハウス一級建築士事務所')).toBe('company');
    expect(classifyChannel('設計事務所 タビ【TAWKS & Tabi Architects】')).toBe('company');
  });

  test('UT-07-05: 「建築家」「設計士」「社長」「店長」も company（職業系）', () => {
    expect(classifyChannel('島根をぬくめる建築家 ルラクホーム')).toBe('company');
    expect(classifyChannel('女性建築家と学ぶ家づくりスタジオ　設計士 MATSUI')).toBe('company');
    expect(classifyChannel('7代目社長の後悔しない家づくりch')).toBe('company');
    expect(classifyChannel('塗装屋社長の現場リアルチャンネル')).toBe('company');
    expect(classifyChannel('店長磯野の『広く深く!!超かんたん家づくり解説』')).toBe('company');
  });

  test('UT-07-06: 「住宅」「建築」「リフォーム」「スタジオ」「教室」も company', () => {
    expect(classifyChannel('共感住宅 ray-out')).toBe('company');
    expect(classifyChannel('中立公正な総合住宅相談所')).toBe('company');
    expect(classifyChannel('ReMoreのリフォーム')).toBe('company');
    expect(classifyChannel('家づくりスタジオ')).toBe('company');
    expect(classifyChannel('アキラ先生の住まいの間取り教室【船渡亮】')).toBe('company');
  });

  test('UT-07-07: 大文字英語「HOMES」「HOUSE」「Official」も company', () => {
    expect(classifyChannel('SOMETHING HOMES')).toBe('company');
    expect(classifyChannel('WELLNEST HOME')).toBe('company');
    expect(classifyChannel('Official Channel')).toBe('company');
  });
});

describe('classifyChannel() — 弱企業キーワード（個人除外との優先順位）', () => {
  test('UT-07-08: 「ホーム」「ハウス」「ハウジング」は弱企業判定で company', () => {
    expect(classifyChannel('ロゴスホームの賢い家づくりチャンネル')).toBe('company');
    expect(classifyChannel('ウェルネストホーム九州')).toBe('company');
    expect(classifyChannel('ありそうでなかった家づくり　マレアハウスデザイン')).toBe('company');
    expect(classifyChannel('ぶっちゃけハウジング')).toBe('company');
  });

  test('UT-07-09: 個人除外キーワードは強企業キーワードを上書きする', () => {
    expect(classifyChannel('マイホームちゃんねる')).toBe('individual');
    expect(classifyChannel('きょんのおうち')).toBe('individual');
    expect(classifyChannel('なすびのおうち')).toBe('individual');
    expect(classifyChannel('Roommyルームツアー')).toBe('individual');
    expect(classifyChannel('KEINAchannel  けいなちゃんねる')).toBe('individual');
    expect(classifyChannel('間取りチャンネル')).toBe('individual');
    expect(classifyChannel('ハッピーライフな家造り 4kidsパパ')).toBe('individual');
    // 「マイホーム」+「住宅」両方含むが個人優先
    expect(classifyChannel('むちまるCH【マイホーム＆注文住宅情報発信】')).toBe('individual');
  });
});

describe('classifyChannel() — デフォルト individual', () => {
  test('UT-07-10: 強企業も弱企業も該当しないチャンネルは individual', () => {
    expect(classifyChannel('ぎゅうの住みやすい暮らし術')).toBe('individual');
    expect(classifyChannel('SORAHhouse~29坪コンパクトな2人暮らし~')).toBe('individual');
    expect(classifyChannel('48歳から家を建てるおじさん')).toBe('individual');
  });
});

describe('classifyChannel() — overrides 最優先', () => {
  test('UT-07-11: overrides で個別上書きできる（企業判定→個人 / 個人判定→企業）', () => {
    const overrides = {
      // 通常 individual のものを company に
      'ぎゅうの住みやすい暮らし術': 'company',
      // 通常 company のものを individual に
      '職人社長の家づくり工務店': 'individual',
    };
    expect(classifyChannel('ぎゅうの住みやすい暮らし術', overrides)).toBe('company');
    expect(classifyChannel('職人社長の家づくり工務店', overrides)).toBe('individual');
    // overrides にないものは通常ルール
    expect(classifyChannel('きょんのおうち', overrides)).toBe('individual');
  });

  test('UT-07-12: 空文字 / 非文字列は individual', () => {
    expect(classifyChannel('')).toBe('individual');
    expect(classifyChannel(null)).toBe('individual');
    expect(classifyChannel(undefined)).toBe('individual');
    expect(classifyChannel(123)).toBe('individual');
  });
});

describe('categoryIdFor()', () => {
  test('UT-07-13: company → CAT-02 / individual → CAT-01', () => {
    expect(categoryIdFor('職人社長の家づくり工務店')).toBe('CAT-02');
    expect(categoryIdFor('きょんのおうち')).toBe('CAT-01');
  });
});
