/**
 * 淘宝 Cookie 获取脚本（Egern 兼容 Surge http-request）
 *
 * 触发条件：淘宝 App 内 h5api.m.taobao.com 的 mtop 请求（含淘金币页面）
 * Cookie 有变化时才保存并通知，避免频繁弹窗
 *
 * 存储 Key：TB_COOKIE
 */

const cookieKey = "TB_COOKIE";

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
        // 提取关键认证字段
        const fields = ["cookie2", "_tb_token_", "sgcookie", "unb", "lgc", "tracknick"];
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

const cookie = getCookieFromRequest();
saveCookie(cookie);

$done({});
