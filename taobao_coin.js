/**
 * 淘宝淘金币 自动签到脚本（Egern 原生版）
 *
 * 功能：每日签到 / 领取待领金币 / 查询余额
 * 依赖：淘宝 Cookie 模块抓取的 TB_COOKIE（需包含 _m_h5_tk 字段用于签名）
 */

const COOKIE_KEY = 'TB_COOKIE';
const APP_KEY = '12574478';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const REFERER = 'https://pages.tmall.com/wow/a/act/dailycoin';

// ================= MD5 实现 =================
function md5(str) {
  function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
  function au(x, y) { var l = (x & 0xFFFF) + (y & 0xFFFF), m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xFFFF); }
  function cvt(n, b) { var m = (1 << (8 * b)) - 1, x = ''; for (var i = 0; i < 4 * b; i++) { x += ((n >> (i * 8 + 4)) & 0xF).toString(16) + ((n >> (i * 8)) & 0xF).toString(16); } return x; }
  function binl(x, len) {
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    var i, olda, oldb, oldc, oldd;
    var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (i = 0; i < x.length; i += 16) {
      olda = a; oldb = b; oldc = c; oldd = d;
      a = ff(a, b, c, d, x[i], 7, -680876936);
      d = ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = ff(c, d, a, b, x[i + 10], 17, -42063);
      b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = gg(b, c, d, a, x[i], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558);
      d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = hh(d, a, b, c, x[i], 11, -358537222);
      c = hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i], 6, -198630844);
      d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = au(a, olda); b = au(b, oldb); c = au(c, oldc); d = au(d, oldd);
    }
    return [a, b, c, d];
  }
  function ff(a, b, c, d, x, s, t) { return au(rl(au(au(b, x) + au(d, t)), s), c); }
  function gg(a, b, c, d, x, s, t) { return au(rl(au(au(b, x) + au(c, t)), s), b); }
  function hh(a, b, c, d, x, s, t) { return au(rl(au(au(b, x) + au(d, t)), s), a); }
  function ii(a, b, c, d, x, s, t) { return au(rl(au(au(b, x) + au(c, t)), s), b); }
  function unesc(input) {
    var output = '', i = -1, x, y;
    while (++i < input.length) {
      x = input.charCodeAt(i);
      y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
      if (0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF) { x = 0x10000 + ((x & 0x3FF) << 10) + (y & 0x3FF); i++; }
      output += x;
    }
    return output;
  }
  function str2binl(input) {
    var output = [], i;
    for (i = 0; i < input.length * 32; i += 8) {
      output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return output;
  }
  var input = unesc(str);
  var bin = binl(str2binl(input), input.length * 8);
  return cvt(bin[0], 4) + cvt(bin[1], 4) + cvt(bin[2], 4) + cvt(bin[3], 4);
}

// ================= 主逻辑 =================
export default async function(ctx) {
  const cookie = ctx.storage.get(COOKIE_KEY) || '';
  if (!cookie) {
    ctx.notify({ title: '淘宝淘金币', body: '❌ Cookie 缺失，请先打开淘宝App淘金币页面获取' });
    return;
  }

  // 从 Cookie 提取 mtop 签名令牌
  const tkMatch = cookie.match(/_m_h5_tk=([^_;]+)_/);
  let token = tkMatch ? tkMatch[1] : '';

  const messages = [];

  // mtop 请求（自动处理令牌刷新重试）
  async function mtop(api, v, dataObj) {
    const dataStr = JSON.stringify(dataObj || {});
    async function call(tk) {
      const t = Date.now();
      const sign = tk ? md5(tk + '&' + t + '&' + APP_KEY + '&' + dataStr) : '';
      const url = `https://h5api.m.taobao.com/h5/${api}/${v}/?jsv=2.7.2&appKey=${APP_KEY}&t=${t}&sign=${sign}&api=${api}&v=${v}&type=originaljson&dataType=json&data=${encodeURIComponent(dataStr)}`;
      return ctx.http.post(url, {
        headers: {
          'Cookie': cookie,
          'User-Agent': UA,
          'Referer': REFERER,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });
    }
    let resp = await call(token);
    let j = await resp.json();
    const ret = (j.ret && j.ret[0]) || '';
    if (/TOKEN_EMPTY|TOKEN_EXOIRED|TOKEN_OVERDUE|ILLEGAL_ACCESS/i.test(ret)) {
      const sc = resp.headers.get('set-cookie') || '';
      const m2 = sc.match(/_m_h5_tk=([^_;]+)_/);
      if (m2) {
        token = m2[1];
        resp = await call(token);
        j = await resp.json();
      }
    }
    return j;
  }

  function retOf(j) { return (j.ret && j.ret[0]) || '无返回'; }

  // 1. 签到
  try {
    const j = await mtop('mtop.taobao.coin.signedin', '1.0', {});
    const ret = retOf(j);
    if (ret.indexOf('SUCCESS') === 0 && j.data) {
      const r = j.data.result || {};
      messages.push('【签到】' + (r.success ? `成功，获得 ${r.coinNum || ''} 金币` : (r.message || '成功')));
    } else if (ret.includes('已签到') || ret.includes('已经')) {
      messages.push('【签到】今日已签到');
    } else {
      messages.push('【签到】失败: ' + ret);
    }
  } catch(e) {
    messages.push('【签到】异常: ' + (e && e.message ? e.message : e));
  }

  await new Promise(r => setTimeout(r, 2000));

  // 2. 领取待领金币
  try {
    const j = await mtop('mtop.taobao.coin.acquire', '1.0', {});
    const ret = retOf(j);
    if (ret.indexOf('SUCCESS') === 0 && j.data) {
      const r = j.data.result || {};
      messages.push('【领金币】' + (r.success ? `领取 ${r.coinNum || 0} 金币` : (r.message || '暂无可领金币')));
    } else {
      messages.push('【领金币】' + ret);
    }
  } catch(e) {
    messages.push('【领金币】异常: ' + (e && e.message ? e.message : e));
  }

  await new Promise(r => setTimeout(r, 1000));

  // 3. 查询余额
  try {
    const j = await mtop('mtop.taobao.coin.home', '1.0', {});
    const ret = retOf(j);
    if (ret.indexOf('SUCCESS') === 0 && j.data) {
      const r = j.data.result || {};
      messages.push('【余额】当前金币：' + (r.coinAmount || r.totalCoin || '未知'));
    } else {
      messages.push('【余额】' + ret);
    }
  } catch(e) {
    messages.push('【余额】异常: ' + (e && e.message ? e.message : e));
  }

  const ok = messages.some(m => m.includes('成功') || m.includes('已签到'));
  ctx.notify({
    title: '淘宝淘金币',
    subtitle: ok ? '✅ 任务完成' : '⚠️ 部分任务异常',
    body: messages.join('\n')
  });
}
