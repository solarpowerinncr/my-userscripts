// ==UserScript==
// @name         ao3.ac 浅黄护眼主题（适配真实阅读页面）
// @namespace    local.ao3ac.eye-care
// @version      2.1
// @updateURL    https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/ao3-ac-eye-care.user.js
// @downloadURL  https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/ao3-ac-eye-care.user.js
// @description  将 ao3.ac 的暗色阅读界面调整为浅黄底深色字，保留正文排版与 Read Frog 双语翻译
// @match        https://ao3.ac/*
// @match        https://www.ao3.ac/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        /* 主题颜色：修改这里即可改变底色及文字颜色 */
        :root {
            color-scheme: light !important;
            --bg: #FFF8E1 !important;
            --bg-raise: #FFF8E1 !important;
            --bg-raised: #F5EBCF !important;
            --text: #171717 !important;
            --text-2: #292929 !important;
            --text-3: #494949 !important;
            --line: #D8CEB2 !important;
            --line-strong: #998D72 !important;
        }

        html, body {
            background: #FFF8E1 !important;
            color: #171717 !important;
            scrollbar-color: #A99D80 #FFF8E1 !important;
            accent-color: #6D5930 !important;
        }

        /* 真实网页的 .neon 根容器在此重新声明了一套主题变量 */
        .neon {
            --bg: #FFF8E1 !important;
            --panel: #FFF8E1 !important;
            --ink: #171717 !important;
            --ink-2: #292929 !important;
            --ink-3: #494949 !important;
            --line: #D8CEB2 !important;
            --line-strong: #998D72 !important;
            background: #FFF8E1 !important;
            color: #171717 !important;
        }

        /* 顶部导航、底部说明及正文阅读容器 */
        .neon .hud,
        .neon .foot,
        .neon .reader,
        .neon .reader .page,
        .neon .reader .rail-in,
        .neon .reader .toc {
            background-color: #FFF8E1 !important;
            color: #171717 !important;
        }

        /* 小说正文：仅改变颜色，不修改字体、粗斜体、行距、段距 */
        .neon .reader .text {
            color: #171717 !important;
            background-color: transparent !important;
        }

        .neon .reader .text a,
        .neon .reader .text a:visited {
            color: #171717 !important;
            text-decoration: underline;
        }

        /* 章节列表、字体设置、翻页按钮 */
        .neon .reader .toc-btn,
        .neon .reader .ctl button,
        .neon .reader .flip a {
            border-color: #C6B993 !important;
            color: #171717 !important;
        }

        /* 原站使用硬编码的白色按钮，需要单独覆盖 */
        .neon nav a[aria-current="page"],
        .neon .reader .toc a[aria-current="page"],
        .neon .reader .toc-btn[aria-expanded="true"],
        .neon .reader .ctl button[aria-pressed="true"],
        .neon .reader .flip a.nxt {
            background: #E9DDBB !important;
            color: #171717 !important;
            border-color: #BBAA82 !important;
        }

        .neon .reader .toc a:hover,
        .neon .reader .toc-btn:hover,
        .neon .reader .ctl button:hover,
        .neon .reader .flip a:hover {
            background: #F1E5C4 !important;
            color: #171717 !important;
        }

        /* 阅读进度条及原网页的白色扫描线装饰 */
        .neon .bar > span { background: #998D72 !important; }
        .neon .fx-scan { display: none !important; }

        /* Cookie 弹窗（有时显示于页面底部） */
        .neon .cookies {
            background: #FFF8E1 !important;
            color: #171717 !important;
            border-color: #998D72 !important;
        }
        .neon .cookies p,
        .neon .cookies button { color: #171717 !important; }
        .neon .cookies button { border-color: #C6B993 !important; }
        .neon .cookies button:hover { background: #E9DDBB !important; }

        /* 选中文字及键盘焦点 */
        .neon ::selection { background: #E4D29A !important; color: #171717 !important; }
        .neon :focus-visible { outline-color: #8A7040 !important; }
    `);
})();