// NetSpeed 10s 小组件
// 持续测速 10 秒：每秒记录一次速度，结束后显示平均值与逐秒数据
// 同时显示当前出口节点（国家/地区旗帜 + 运营组织）

export default async function(ctx) {
  const TEST_SECONDS = 10;
  const CHUNK_MB = 1;
  const CHUNK_BYTES = CHUNK_MB * 1024 * 1024;
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${CHUNK_BYTES}`;
  const TRACE_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
  const CACHE_KEY = 'netspeed_10s_cache';

  // 先读缓存，测速失败或进行中时展示上次结果
  let result = { avgMbps: 0, mBs: 0, duration: 0, samples: [], node: null, timestamp: 0 };
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.samples) result = cached;
  } catch(e) {}

  // ---- 获取当前出口节点 ----
  function flagEmoji(code) {
    if (!code || code.length !== 2) return '🌐';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
  }

  try {
    const resp = await ctx.http.get(TRACE_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 8000
    });
    const t = await resp.text();
    const get = (k) => {
      const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
      return m ? m[1].trim() : '';
    };
    const ip = get('ip');
    let country = get('loc');
    let org = '';
    try {
      const geo = ctx.lookupIP(ip);
      if (geo) {
        if (geo.country) country = geo.country;
        if (geo.organization) org = geo.organization;
      }
    } catch(e) {}
    if (org.length > 16) org = org.slice(0, 16);
    result.node = { flag: flagEmoji(country), org: org || ip };
  } catch(e) {
    if (!result.node) result.node = { flag: '🌐', org: '未知' };
  }

  // ---- 10 秒测速 ----
  const start = Date.now();
  const endAt = start + TEST_SECONDS * 1000;
  let totalBytes = 0;
  const samples = [];
  let lastMark = start;
  let lastBytes = 0;

  // 循环下载 1MB 数据块，直到满 10 秒
  while (Date.now() < endAt) {
    try {
      await ctx.http.get(SPEED_TEST_URL, {
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 10000
      });
      totalBytes += CHUNK_BYTES;
    } catch(e) {
      break;
    }
    // 每跨过 1 秒边界，记录该秒的速度
    const now = Date.now();
    while (now - lastMark >= 1000 && samples.length < TEST_SECONDS) {
      lastMark += 1000;
      const mbps = ((totalBytes - lastBytes) * 8) / 1e6;
      samples.push(parseFloat(mbps.toFixed(1)));
      lastBytes = totalBytes;
    }
  }

  const duration = (Date.now() - start) / 1000;
  // 网络过慢导致不足 10 条时，缺的秒补 0
  while (samples.length < TEST_SECONDS) samples.push(0.0);

  // 测速成功才覆盖缓存（平均值 = 逐秒数据的平均）
  if (totalBytes > 0) {
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    result = {
      avgMbps: parseFloat(avg.toFixed(1)),
      mBs: parseFloat((avg / 8).toFixed(2)),
      duration: parseFloat(duration.toFixed(1)),
      samples: samples,
      node: result.node,
      timestamp: Date.now()
    };
    try { ctx.storage.setJSON(CACHE_KEY, result); } catch(e) {}
  }

  let icon = 'tortoise';
  let color = '#FF9500';

  if (result.avgMbps >= 50) {
    icon = 'bolt.fill';
    color = '#34C759';
  } else if (result.avgMbps >= 10) {
    icon = 'hare.fill';
    color = '#007AFF';
  }

  let barWidth = 30;
  if (result.avgMbps >= 80) barWidth = 140;
  else if (result.avgMbps >= 50) barWidth = 110;
  else if (result.avgMbps >= 20) barWidth = 80;
  else if (result.avgMbps >= 10) barWidth = 55;

  const now = new Date(result.timestamp || Date.now());
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const isSmall = ctx.widgetFamily === 'systemSmall';
  const nodeText = result.node ? `${result.node.flag} ${result.node.org}` : '🌐 未知';

  // 逐秒数据按每行 5 个排成两行
  function sampleRow(values, offset) {
    const children = [{ type: 'spacer' }];
    values.forEach((v, idx) => {
      children.push({
        type: 'text',
        text: `${offset + idx + 1}s ${Number(v).toFixed(1)}`,
        font: { size: 'caption2' },
        textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
      });
      children.push({ type: 'spacer' });
    });
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      children: children
    };
  }

  const rows = [];
  for (let i = 0; i < result.samples.length; i += 5) {
    rows.push(sampleRow(result.samples.slice(i, i + 5), i));
  }

  const sampleSection = [
    {
      type: 'text',
      text: '每秒测速 (Mbps)',
      font: { size: 'caption2', weight: 'semibold' },
      textColor: { light: '#8E8E93', dark: '#8E8E93' }
    }
  ].concat(rows);

  return {
    type: 'widget',
    padding: isSmall ? 10 : 14,
    gap: isSmall ? 5 : 7,

    backgroundColor: {
      light: '#FFFFFF',
      dark: '#2C2C2E'
    },

    children: [

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            width: isSmall ? 13 : 15,
            height: isSmall ? 13 : 15,
            color: color
          },
          {
            type: 'text',
            text: ' NetSpeed 10s',
            font: { size: 'caption2', weight: 'semibold' },
            textColor: color
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `↻ ${timeStr}`,
            font: { size: 'caption2' },
            textColor: { light: '#8E8E93', dark: '#8E8E93' }
          }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'spacer' },
          {
            type: 'text',
            text: `${result.avgMbps} Mbps`,
            font: { size: isSmall ? 24 : 32, weight: 'bold' },
            textColor: color
          },
          { type: 'spacer' }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          {
            type: 'image',
            src: 'sf-symbol:mappin.and.ellipse',
            width: isSmall ? 11 : 12,
            height: isSmall ? 11 : 12,
            color: color
          },
          {
            type: 'text',
            text: ` ${nodeText}`,
            font: { size: 'caption2', weight: 'medium' },
            textColor: { light: '#3A3A3C', dark: '#C7C7CC' },
            lineLimit: 1
          },
          { type: 'spacer' }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        children: [
          { type: 'spacer' },
          {
            type: 'stack',
            width: barWidth,
            height: 4,
            backgroundColor: color,
            cornerRadius: 2
          },
          { type: 'spacer' }
        ]
      }
    ]
    .concat(isSmall ? [] : sampleSection)
    .concat([
      {
        type: 'stack',
        direction: 'row',
        children: [
          {
            type: 'text',
            text: `均值 ${result.mBs} MB/s`,
            font: { size: 'caption2' },
            textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `耗时 ${result.duration}s`,
            font: { size: 'caption2' },
            textColor: { light: '#6B6B6B', dark: '#A1A1A6' }
          }
        ]
      }
    ])
  };
}
