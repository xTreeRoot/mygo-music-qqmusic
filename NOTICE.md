# 来源与修改说明

- 主体源码及测试来自 Amamiya23/mygo-music-qq-plugin，提交 `e341a3b03c5da68397ce02e0994367c1a16b3a7e`（0.3.0）：https://github.com/Amamiya23/mygo-music-qq-plugin 。沿用 AGPL-3.0，完整许可证见 LICENSE。
- 公开 Web 搜索接口参考 dddaniel1/mygo-plugin-qqmusic，提交 `4bb04cc4d5f8ff2ea528a237c4fe9737b79eda87`：https://github.com/dddaniel1/mygo-plugin-qqmusic 。其 MIT 许可证保留在 web-reference.LICENSE。
- MyGo 插件接口参考 https://music.egoist.dev/zh/plugins 和 egoist/mygo-music 的 README。
- 微信扫码、设备信息和 `wifiurl` 播放地址处理参考第三方开源项目。该仓库不包含账号登录数据。

2026-11-07 修改（Lorpaves）：默认微信登录、中文提示、登录并发保护、公开搜索回退、wifiurl 播放兼容、自建/系统歌单分类，收藏专辑发行日期类型修复，以及对应的测试和文档。本仓库是独立衍生版本，0.3.2 并非上游正式发布版本。

QR 解码使用 jsQR、jpeg-js 和 pako；构建后许可证保留于 dist。逐字歌词代码中的 DES 表和 pako 许可证保留于 qrc-des.LICENSE、qrc-pako.LICENSE。

2026-11-21 修改（xTreeRoot，0.3.6）：基于 Lorpaves/mygo-music-qqmusic 提交 `e4b4138ee9a234cbe1ed0e4c23234b0c67249fac`（0.3.5）继续维护：https://github.com/Lorpaves/mygo-music-qqmusic 。增加三端 UTF-8 歌词解码、可取消登录、保留并验证复用会话、微信刷新账号校验、媒体域名与请求头、首页更多入口、对应回归及真实运行时验证脚本。保留 AGPL-3.0、原作者版权和上述第三方许可证；本版本为独立衍生发布。
