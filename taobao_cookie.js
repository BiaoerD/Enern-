/**
 * 淘宝 Cookie 获取脚本（Egern 兼容 Surge http-request）
 *
 * 触发条件：淘宝 App 内 h5api/acs.m.taobao.com 的 mtop 请求（含淘金币页面）
 * 1. Cookie 有变化时才保存并通知（Key：TB_COOKIE）
 * 2. 记录淘金币相关接口名（Key：taojinbi_api_list），供签到脚本自动发现接口
 */

const cookieKey = "TB_COOKIE";
const apiListKey = "taojinbi_api_list";

function getCookieFromRequest() {
    return $request.headers["Cookie"] || $request.headers["cookie"] || "";
}

function saveCookie(rawCookie) {
    if (!rawCookie || rawCookie.length < 10) {
        return false;
    }

    // 淘宝核心认证字段：cookie2、_tb_token_、sgcookie、unb
    const hasAuth = rawCookie.includes("cookie2") || rawCookie.includes("_tb_token_") || rawCookie.includes("sgcookie");

    let cookieToSave = rawCookie;
    if (hasAuth) {
        // 提取关键认证字段（含 mtop 签名所需的 _m_h5_tk）
        const fields = ["cookie2", "_tb_token_", "sgcookie", "unb", "lgc", "tracknick", "_m_h5_tk", "_m_h5_tk_enc"];
        const usefulParts = [];
        fields.forEach(field => {
            const match = rawCookie.match(new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "=[^;]+"));
            if (match) usefulParts.push(match[0]);
        });
        if (usefulParts.length > 0) {
            cookieToSave = usefulParts.join("; ");
        }
    }

    // Cookie 有变化才写入并通知
    const old = $persistentStore.read(cookieKey);
    if (old === cookieToSave) {
        console.log("淘宝 Cookie 未变化，跳过");
    } else {
        $persistentStore.write(cookieToSave, cookieKey);
        const title = hasAuth ? "✅ Cookie 获取成功" : "✅ Cookie 已保存（完整）";
        $notification.post("淘宝淘金币", title, "Cookie 已更新，淘金币签到任务将自动运行");
        console.log("淘宝 Cookie 保存成功");
    }
    return true;
}

// 记录淘金币相关 mtop 接口（api 名 + 版本 + data 参数）
function recordCoinApi(url) {
    try {
        const apiMatch = url.match(/[?&]api=([^&]+)/);
        if (!apiMatch) return;
        const api = decodeURIComponent(apiMatch[1]);
        if (!/coin|jinbi/i.test(api)) return;

        const vMatch = url.match(/[?&]v=([^&]+)/);
        const dataMatch = url.match(/[?&]data=([^&]*)/);
        const entry = {
            api: api,
            v: vMatch ? decodeURIComponent(vMatch[1]) : "1.0",
            data: dataMatch ? decodeURIComponent(dataMatch[1]) : "{}"
        };

        let list = [];
        try { list = JSON.parse($persistentStore.read(apiListKey) || "[]"); } catch (e) {}

        const idx = list.findIndex(x => x.api === api);
        if (idx >= 0) {
            list[idx] = entry; // 更新参数
        } else {
            list.push(entry);
            if (list.length > 10) list = list.slice(-10);
        }
        $persistentStore.write(JSON.stringify(list), apiListKey);
        console.log("已记录淘金币接口: " + api);
    } catch (e) {}
}

const cookie = getCookieFromRequest();
saveCookie(cookie);
recordCoinApi($request.url);

$done({});
