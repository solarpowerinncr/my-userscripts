# 我的油猴脚本

个人维护的 Tampermonkey 用户脚本合集，支持通过 GitHub Raw 地址自动更新。

## 脚本列表

| 脚本 | 功能 | 版本 | 安装 |
|---|---|---:|---|
| **ao3.ac 浅黄护眼主题** | 为 ao3.ac 阅读页面设置浅黄色背景和深色正文，保留原有排版；不强制覆盖 Read Frog 译文颜色 | 1.0.0 | [安装脚本](https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/ao3-ac-eye-care.user.js) · [查看源码](https://github.com/solarpowerinncr/my-userscripts/blob/master/ao3-ac-eye-care.user.js) |
| **微博收藏直接查看 + 悬停内容预览** | 隐藏收藏列表中的二维码入口，增加直接查看链接，并在悬停时预览微博正文、图片和视频 | 1.0.0 | [安装脚本](https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/weibo-fav-hover-preview.user.js) · [查看源码](https://github.com/solarpowerinncr/my-userscripts/blob/master/weibo-fav-hover-preview.user.js) |

## 安装方法

1. 在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 使用已安装 Tampermonkey 的浏览器打开本 README，点击对应脚本的「安装脚本」。
3. 在 Tampermonkey 安装确认页检查脚本权限并确认安装。

如果点击后只显示源码，请复制对应的 Raw 地址，在 Tampermonkey 的「实用工具 / Utilities」中使用「从 URL 安装」。

## 自动更新

两个脚本均已配置 `@updateURL` 和 `@downloadURL`，指向本仓库的 Raw 文件。

更新脚本时：
1. 修改对应的 `.user.js` 文件。
2. 提升脚本头部的 `@version`。
3. 提交到 `master` 分支。

Tampermonkey 会根据自身的更新检查设置检测新版本。每台设备首次需要分别安装一次，之后可独立检查更新。

## 权限说明

- AO3 护眼脚本仅匹配 `ao3.ac/r/` 及其 `www` 子域名，使用 `GM_addStyle` 注入样式。
- 微博预览脚本匹配 `weibo.com`，使用 `GM_xmlhttpRequest` 请求 `m.weibo.cn` 接口，并声明了 `@connect m.weibo.cn` 权限。
- 安装前请检查脚本源码及 Tampermonkey 显示的权限。
