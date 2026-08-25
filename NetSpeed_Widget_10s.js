// NetSpeed 10s 小组件
// 持续测速 10 秒：每秒记录一次速度，结束后显示平均值与逐秒数据
// 节点显示：参考「网络诊断雷达」——优先从 ctx 读取节点名/协议，
// 出口信息通过 ip-api.com 查询（国家/城市/ISP，中文）

export default async function(ctx) {
  const TEST_SECONDS = 10;
  const CHUNK_MB = 1;
  const CHUNK_BYTES = CHUNK_MB * 1024 * 1024;
  const SPEED_TEST_URL = `https://speed.cloudflare.com/__down?bytes=${CHUNK_BYTES}`;
  const TRACE_URL = 'https://www.cloudflare.com/cdn-cgi/trace';
  const CACHE_KEY = 'netspeed_10s_cache';

  // ================= 通用工具（移植自网络诊断雷达） =================

  function clean(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function pick() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== undefined && v !== null && clean(v) !== "") return v;
    }
    return "";
  }

  function getAt(object, path) {
    const keys = String(path).split(".");
    let current = object;
    for (let i = 0; i < keys.length; i++) {
      if (!current || typeof current !== "object" || !(keys[i] in current)) return "";
      current = current[keys[i]];
    }
    return current === undefined || current === null ? "" : current;
  }

  function isMeaningful(value) {
    const v = clean(value);
    const lower = v.toLowerCase();
    if (!v) return false;
    if (["--", "-", "—"].includes(v)) return false;
    if (["null", "undefined", "unknown", "unknow", "none", "n/a"].includes(lower)) return false;
    if (["wifi", "wlan", "5g", "4g", "lte", "nr"].includes(lower)) return false;
    return true;
  }

  function countryCode(value) {
    const code = clean(value).toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : "";
  }

  function flag(code) {
    const c = countryCode(code);
    if (!c) return "";
    return (
      String.fromCodePoint(c.charCodeAt(0) + 127397) +
      String.fromCodePoint(c.charCodeAt(1) + 127397)
    );
  }

  function shortISP(value) {
    const isp = clean(value);
    if (!isp) return "";
    if (isp.length <= 14) return isp;
    const words = isp.split(/\s+/);
    if (words.length > 1) return words[0];
    return isp.slice(0, 13) + "…";
  }

  function normalizeProxyProtocol(value) {
    const raw = clean(value);
    const text = raw.toLowerCase();
    if (!text) return "";
    const normalized = text
      .replace(/[_\-]+/g, " ")
      .replace(/[()[\]{}|,;]+/g, " ");
    const checks = [
      [/vless/, "VLESS"],
      [/vmess/, "VMESS"],
      [/trojan/, "Trojan"],
      [/shadowsocks\s*r|ssr/, "SSR"],
      [/shadowsocks|(^|\s)ss($|\s)/, "SS"],
      [/hysteria\s*2|hy2/, "HY2"],
      [/hysteria/, "Hysteria"],
      [/tuic/, "TUIC"],
      [/snell/, "Snell"],
      [/any\s*tls|anytls/, "AnyTLS"],
      [/wireguard|(^|\s)wg($|\s)/, "WireGuard"],
      [/socks\s*5|socks5/, "SOCKS5"],
      [/socks/, "SOCKS"],
      [/https/, "HTTPS"],
      [/http/, "HTTP"],
      [/ssh/, "SSH"]
    ];
    for (let i = 0; i < checks.length; i++) {
      if (checks[i][0].test(normalized)) return checks[i][1];
    }
    return "";
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object";
  }

  function findProxyNameInObject(object) {
    const found = [];
    const seen = [];
    function walk(value, path, depth) {
      if (depth > 5) return;
      if (!isPlainObject(value)) return;
      if (seen.indexOf(value) >= 0) return;
      seen.push(value);
      Object.keys(value).forEach(function (key) {
        const next = value[key];
        const nextPath = path ? path + "." + key : key;
        const lowerPath = nextPath.toLowerCase();
        if (typeof next === "string") {
          if (
            isMeaningful(next) &&
            (lowerPath.includes("proxy") || lowerPath.includes("node") ||
              lowerPath.includes("outbound") || lowerPath.includes("policy")) &&
            (lowerPath.includes("name") || lowerPath.includes("title"))
          ) {
            found.push(next);
          }
        } else if (isPlainObject(next)) {
          walk(next, nextPath, depth + 1);
        }
      });
    }
    walk(object, "", 0);
    return found[0] || "";
  }

  function findProtocolInObject(object) {
    const found = [];
    const seen = [];
    function walk(value, path, depth) {
      if (depth > 5) return;
      if (!isPlainObject(value)) return;
      if (seen.indexOf(value) >= 0) return;
      seen.push(value);
      Object.keys(value).forEach(function (key) {
        const next = value[key];
        const nextPath = path ? path + "." + key : key;
        const lowerPath = nextPath.toLowerCase();
        if (typeof next === "string") {
          const protocol = normalizeProxyProtocol(next);
          if (
            protocol &&
            (lowerPath.includes("proxy") || lowerPath.includes("node") ||
              lowerPath.includes("outbound") || lowerPath.includes("policy") ||
              lowerPath.includes("protocol") || lowerPath.includes("scheme"))
          ) {
            found.push(protocol);
          }
        } else if (isPlainObject(next)) {
          walk(next, nextPath, depth + 1);
        }
      });
    }
    walk(object, "", 0);
    return found[0] || "";
  }

  function getCurrentProxyInfo(context) {
    const proxyName = clean(
      pick(
        getAt(context, "node.name"),
        getAt(context, "proxy.name"),
        getAt(context, "currentProxy.name"),
        getAt(context, "selectedProxy.name"),
        getAt(context, "selectedNode.name"),
        getAt(context, "policy.node.name"),
        getAt(context, "policy.selected.name"),
        getAt(context, "policy.current.name"),
        getAt(context, "outbound.name"),
        getAt(context, "profile.currentNode.name"),
        getAt(context, "profile.selectedNode.name"),
        findProxyNameInObject(context)
      )
    );

    const rawProtocol = clean(
      pick(
        getAt(context, "node.protocol"),
        getAt(context, "node.type"),
        getAt(context, "proxy.protocol"),
        getAt(context, "proxy.type"),
        getAt(context, "currentProxy.type"),
        getAt(context, "selectedProxy.type"),
        getAt(context, "selectedNode.type"),
        getAt(context, "policy.node.type"),
        getAt(context, "outbound.type"),
        findProtocolInObject(context)
      )
    );

    return {
      name: proxyName,
      protocol:
        normalizeProxyProtocol(rawProtocol) ||
        normalizeProxyProtocol(proxyName)
    };
  }

  // ================= 主逻辑 =================

  // 先读缓存，测速失败或进行中时展示上次结果
  let result = { avgMbps: 0, mBs: 0, duration: 0, samples: [], node: null, timestamp: 0 };
  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.samples) result = cached;
  } catch(e) {}

  // ---- 获取当前节点信息（参考网络诊断雷达） ----
  const proxyInfo = getCurrentProxyInfo(ctx);

  let exit = null;
  // 1) ip-api.com：中文国家/城市/ISP
  try {
    const r = await ctx.http.get(
      "http://ip-api.com/json/?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as&_=" + Date.now(),
      {
        headers: { "Cache-Control": "no-cache", Accept: "application/json,text/plain,*/*" },
        timeout: 8000
      }
    );
    const d = await r.json();
    if (d && d.status !== "fail" && clean(d.query)) {
      exit = {
        ip: clean(d.query),
        country: clean(d.country),
        cc: countryCode(d.countryCode),
        city: clean(d.city),
        isp: clean(d.isp) || clean(d.org)
      };
    }
  } catch(e) {}

  // 2) 兜底：Cloudflare trace + lookupIP
  if (!exit) {
    try {
      const resp = await ctx.http.get(TRACE_URL, {
        headers: { "Cache-Control": "no-cache" },
        timeout: 8000
      });
      const t = await resp.text();
      const get = (k) => {
        const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
        return m ? m[1].trim() : '';
      };
      const ip = get('ip');
      let cc = get('loc');
      let isp = '';
      try {
        const geo = ctx.lookupIP(ip);
        if (geo) {
          if (geo.country) cc = geo.country;
          if (geo.organization) isp = geo.organization;
        }
      } catch(e) {}
      exit = { ip: ip, country: '', cc: countryCode(cc), city: '', isp: isp };
    } catch(e) {}
  }

  const node = {
    name: proxyInfo.name,
    protocol: proxyInfo.protocol,
    flag: exit ? flag(exit.cc) : '',
    country: exit ? exit.country : '',
    city: exit ? exit.city : '',
    isp: exit ? exit.isp : ''
  };
  result.node = node;

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
      node: node,
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

  // 节点显示文本：节点名 > 出口城市/ISP > 协议
  const n = result.node || {};
  const nodeParts = [];
  if (n.name) nodeParts.push(n.name);
  const geoText = [n.flag, n.city || n.country].filter(Boolean).join(' ');
  if (geoText) nodeParts.push(geoText);
  if (!n.name && n.isp) nodeParts.push(shortISP(n.isp));
  if (n.protocol) nodeParts.push(n.protocol);
  const nodeText = nodeParts.join(' · ') || '未知';

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
