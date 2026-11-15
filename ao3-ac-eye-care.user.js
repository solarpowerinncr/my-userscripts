// ==UserScript==
// @name         ao3.ac 浅黄护眼主题
// @namespace    local.ao3ac.eye-care
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/ao3-ac-eye-care.user.js
// @downloadURL  https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/ao3-ac-eye-care.user.js
// @description  将 ao3.ac 的暗色阅读界面调整为浅黄背景、深色原文，保留陪读蛙翻译颜色
// @match        https://ao3.ac/r/*
// @match        https://www.ao3.ac/r/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        /*
         * 主题颜色
         * 浅黄背景：#FFF8E1
         * 正文字色：#171717
         *
         * 不修改 Read Frog 的译文颜色
         */

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

        /* 页面背景 */

        html, body {
            background: #FFF8E1 !important;
            color: #171717 !important;

            scrollbar-color:
                #A99D80 #FFF8E1 !important;

            accent-color: #6D5930 !important;
        }

        /*
         * ao3.ac 使用 .neon 作为主题根容器
         * 这里覆盖网站自身的主题变量
         */

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

        /*
         * 顶部导航、正文阅读区域、
         * 侧边栏、底部导航
         */

        .neon .hud,
        .neon .foot,
        .neon .reader,
        .neon .reader .page,
        .neon .reader .rail-in,
        .neon .reader .toc {
            background-color: #FFF8E1 !important;
            color: #171717 !important;
        }

        /*
         * 小说正文
         *
         * 只设置正文容器的颜色，
         * 不使用 .text * 之类的通配规则。
         *
         * Read Frog 的译文元素可以继续
         * 使用自身定义的绿色。
         */

        .neon .reader .text {
            color: #171717 !important;
            background-color: transparent !important;
        }

        /*
         * 正文链接
         */

        .neon .reader .text a,
        .neon .reader .text a:visited {
            color: #171717 !important;
            text-decoration: underline;
        }

        /*
         * 章节列表、字体设置、翻页按钮
         */

        .neon .reader .toc-btn,
        .neon .reader .ctl button,
        .neon .reader .flip a {
            border-color: #C6B993 !important;
            color: #171717 !important;
        }

        /*
         * 当前选中状态
         */

        .neon nav a[aria-current="page"],
        .neon .reader .toc a[aria-current="page"],
        .neon .reader .toc-btn[aria-expanded="true"],
        .neon .reader .ctl button[aria-pressed="true"],
        .neon .reader .flip a.nxt {
            background: #E9DDBB !important;
            color: #171717 !important;
            border-color: #BBAA82 !important;
        }

        /*
         * 按钮悬停状态
         */

        .neon .reader .toc a:hover,
        .neon .reader .toc-btn:hover,
        .neon .reader .ctl button:hover,
        .neon .reader .flip a:hover {
            background: #F1E5C4 !important;
            color: #171717 !important;
        }

        /*
         * 阅读进度条
         */

        .neon .bar > span {
            background: #998D72 !important;
        }

        /*
         * 隐藏原网页的扫描线装饰
         */

        .neon .fx-scan {
            display: none !important;
        }

        /*
         * Cookie 弹窗
         */

        .neon .cookies {
            background: #FFF8E1 !important;
            color: #171717 !important;
            border-color: #998D72 !important;
        }

        .neon .cookies p,
        .neon .cookies button {
            color: #171717 !important;
        }

        .neon .cookies button {
            border-color: #C6B993 !important;
        }

        .neon .cookies button:hover {
            background: #E9DDBB !important;
        }

        /*
         * 选中文字及键盘焦点
         */

        .neon ::selection {
            background: #E4D29A !important;
            color: #171717 !important;
        }

        .neon :focus-visible {
            outline-color: #8A7040 !important;
        }

        /*
         * Read Frog 兼容说明
         *
         * 不覆盖以下元素的 color：
         *
         * .read-frog-translated-content-wrapper
         * .read-frog-translated-block-content
         * .read-frog-translated-inline-content
         *
         * 译文颜色由 Read Frog 自身决定。
         */
    `);
})();
