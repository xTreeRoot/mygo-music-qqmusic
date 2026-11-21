# 0.3.9

- 修复长逐字歌词在移动端解密时触发 `InternalError: interrupted`；分段解密并让出宿主执行循环，保留逐字时间和翻译。

# Changelog

## 0.3.8 — 2026-11-21

- 声明通用 signInMethods 登录选项，并接受 signIn({method})，在新宿主登录入口直接选择 QQ / 微信；旧设置仍兼容。
- 移除与首页精选歌单使用同一接口的 Featured Playlists 导航入口；首页“精选歌单 → 更多”保留。

## 0.3.7 — 2026-11-21

- 将扫码登录方式从手填文字改为 QQ / 微信明确选项，兼容旧设置。
- 切换扫码方式后不再复用另一方式的旧会话；新账号验证成功才替换，取消或失败保留原账号。
- 修复首页、榜单、歌单、收藏专辑和账号头像使用 HTTP / 无协议封面而被移动端拒绝的问题，统一规范为 HTTPS 并保留查询参数。
- 优先使用搜索接口返回的 singerPic，修复自行拼接歌手图片地址造成的 404。
- 对源码与发行包验证两种方式的二维码、取消、旧会话恢复、跨方式切换和各资源封面输出。

## 0.3.4 — 2026-11-12

- Continue to the next lower audio quality when a vkey request returns HTTP 500, 502, 503, or 504, with at most one request per quality (#2).
- Preserve the last server error when no quality succeeds, and keep authentication failures, cancellation, rate limits, malformed replies and invalid stream hosts visible.
- Cover the fallback and error boundaries against both source and the standalone release bundle.

## 0.3.3 — 2026-11-12

- Renew QQ scan sessions from their refresh token before the three-day credential expires, persisting rotated tokens and backing off after failed renewals.
- Prevent late refresh and profile responses from restoring a signed-out account or overwriting a newly selected account.
- Scope concurrent refreshes and retry cooldowns to the active account; verify that QQ refresh responses retain the same account identity.
- Restrict the cached-profile workaround to unexpired QQ scan sessions rejected with code `1000`; revoked credentials and WeChat sessions still sign out.
- Keep raw transport errors out of refresh logs so request credentials cannot be exposed there.
- Preserve WeChat login business codes and report the `20279` device-limit rejection with account-management guidance.

## 0.3.2 — 2026-11-07

First public release of this derivative, based on Amamiya23/mygo-music-qq-plugin 0.3.0.

- Default to WeChat QR login, with Chinese prompts and protection against stale login requests.
- Fall back to QQ Music's public Web search when the desktop endpoint rejects a request.
- Support `wifiurl` playback responses and the QQ Music HTTPS audio CDN fallback.
- Correctly classify owned and system playlists when `dirType` is absent.
- Convert saved-album Unix timestamps to date strings accepted by MyGo, preserving the China release day.
- Include a standalone cross-platform `plugin.zip`, source, licenses, regression tests and read-only live checks.
