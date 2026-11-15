// ==UserScript==
// @name         微博收藏直接查看 + 悬停内容预览
// @namespace    weibo-fav-hover-preview
// @version      5.0.0
// @updateURL    https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/weibo-fav-hover-preview.user.js
// @downloadURL  https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/weibo-fav-hover-preview.user.js
// @description  隐藏“查看二维码”，悬停“直接查看”时通过 m.weibo.cn JSON 接口预览微博正文、图片和视频
// @match        https://weibo.com/*
// @match        https://www.weibo.com/*
// @grant        GM_xmlhttpRequest
// @connect      m.weibo.cn
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const DIRECT_CLASS = 'wb-fav-direct-view';
    const PREVIEW_ID = 'wb-fav-hover-preview';

    const SHOW_DELAY = 250;
    const HIDE_DELAY = 200;

    const cache = new Map();

    let showTimer = null;
    let hideTimer = null;
    let currentMid = null;
    let requestToken = 0;

    // =========================================================
    // 工具函数
    // =========================================================

    function escapeHtml(text = '') {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    /*
     * 微博 text / longTextContent 本身包含 HTML。
     * 为了避免直接信任任意 HTML，这里做简单清理。
     */
    function sanitizeWeiboHtml(html = '') {
        const doc = new DOMParser().parseFromString(
            `<div>${html}</div>`,
            'text/html'
        );

        doc.querySelectorAll(
            'script,style,iframe,object,embed,form,input,button'
        ).forEach(el => el.remove());

        doc.querySelectorAll('*').forEach(el => {
            for (const attr of [...el.attributes]) {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();

                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    continue;
                }

                if (
                    ['href', 'src'].includes(name) &&
                    /^javascript:/i.test(value)
                ) {
                    el.removeAttribute(attr.name);
                }
            }

            if (el.tagName === 'A') {
                el.target = '_blank';
                el.rel = 'noopener noreferrer';
            }
        });

        return doc.body.firstElementChild?.innerHTML || '';
    }

    function formatDate(value) {
        if (!value) return '';

        const d = new Date(value);

        if (Number.isNaN(d.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    }

    function extractMid(qr) {
        const url = qr.getAttribute('qrcode') || '';

        const match = url.match(
            /weibo\.com\/detail\/(\d+)/
        );

        return match?.[1] || null;
    }

    function mobileUrl(mid) {
        return `https://m.weibo.cn/detail/${mid}`;
    }

    // =========================================================
    // GM 请求
    // =========================================================

    function gmRequest(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,

                anonymous: true,

                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'MWeibo-Pwa': '1',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://m.weibo.cn/'
                },

                timeout: 12000,

                onload(response) {
                    if (
                        response.status < 200 ||
                        response.status >= 300
                    ) {
                        reject(
                            new Error(
                                `HTTP ${response.status}`
                            )
                        );
                        return;
                    }

                    try {
                        resolve(
                            JSON.parse(response.responseText)
                        );
                    } catch (err) {
                        reject(
                            new Error('微博接口返回的不是有效 JSON')
                        );
                    }
                },

                onerror() {
                    reject(
                        new Error('微博接口请求失败')
                    );
                },

                ontimeout() {
                    reject(
                        new Error('微博接口请求超时')
                    );
                }
            });
        });
    }

    // =========================================================
    // 获取微博数据
    // =========================================================

    async function fetchStatus(mid) {
        if (cache.has(mid)) {
            return cache.get(mid);
        }

        const promise = (async () => {
            const status = await gmRequest(
                `https://m.weibo.cn/statuses/show?id=${encodeURIComponent(mid)}`
            );

            if (
                !status ||
                (!status.id && !status.mid)
            ) {
                throw new Error(
                    status?.msg ||
                    '没有取得微博正文'
                );
            }

            /*
             * 长微博
             */
            if (status.isLongText) {
                try {
                    const extended = await gmRequest(
                        `https://m.weibo.cn/statuses/extend?id=${encodeURIComponent(mid)}`
                    );

                    if (
                        extended?.data?.longTextContent
                    ) {
                        status.__fullText =
                            extended.data.longTextContent;
                    }
                } catch (err) {
                    console.warn(
                        '[微博悬停预览] 长微博全文读取失败，使用摘要：',
                        err
                    );
                }
            }

            return status;
        })();

        cache.set(mid, promise);

        try {
            return await promise;
        } catch (err) {
            /*
             * 请求失败不缓存，
             * 下次悬停仍然允许重试。
             */
            cache.delete(mid);
            throw err;
        }
    }

    // =========================================================
    // 图片
    // =========================================================

    function getPicUrl(pic) {
        return (
            pic?.large?.url ||
            pic?.largest?.url ||
            pic?.bmiddle?.url ||
            pic?.url ||
            null
        );
    }

    function renderPictures(status) {
        const pics = Array.isArray(status?.pics)
            ? status.pics
            : [];

        if (!pics.length) {
            return '';
        }

        const count = pics.length;

        let cls = 'wb-preview-pics';

        if (count === 1) {
            cls += ' single';
        }

        const html = pics
            .slice(0, 9)
            .map(pic => {
                const url = getPicUrl(pic);

                if (!url) return '';

                return `
                    <a
                        class="wb-preview-pic"
                        href="${escapeHtml(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            src="${escapeHtml(url)}"
                            loading="lazy"
                        >
                    </a>
                `;
            })
            .join('');

        return `
            <div class="${cls}">
                ${html}
            </div>
        `;
    }

    // =========================================================
    // 视频
    // =========================================================

    function getVideoUrl(status) {
        const info =
            status?.page_info?.media_info;

        if (!info) return null;

        return (
            info.stream_url_hd ||
            info.mp4_720p_mp4 ||
            info.mp4_hd_url ||
            info.stream_url ||
            info.mp4_sd_url ||
            null
        );
    }

    function renderVideo(status) {
        const pageInfo = status?.page_info;

        if (!pageInfo) {
            return '';
        }

        const videoUrl =
            getVideoUrl(status);

        const cover =
            pageInfo?.page_pic?.url ||
            '';

        if (videoUrl) {
            return `
                <div class="wb-preview-video">
                    <video
                        controls
                        preload="metadata"
                        ${cover
                            ? `poster="${escapeHtml(cover)}"`
                            : ''
                        }
                    >
                        <source
                            src="${escapeHtml(videoUrl)}"
                        >
                    </video>
                </div>
            `;
        }

        /*
         * 有媒体信息但没有拿到可播放地址：
         * 至少显示封面。
         */
        if (cover) {
            return `
                <div class="wb-preview-video">
                    <img
                        src="${escapeHtml(cover)}"
                        loading="lazy"
                    >
                </div>
            `;
        }

        return '';
    }

    // =========================================================
    // 单条微博
    // =========================================================

    function renderStatus(status, nested = false) {
        if (!status) return '';

        const user =
            status.user || {};

        const avatar =
            user.avatar_hd ||
            user.profile_image_url ||
            '';

        const author =
            user.screen_name ||
            '未知用户';

        const text =
            status.__fullText ||
            status.text ||
            '';

        const date =
            formatDate(status.created_at);

        const source =
            sanitizeWeiboHtml(
                status.source || ''
            );

        const stats = nested
            ? ''
            : `
                <div class="wb-preview-stats">
                    <span>转发 ${status.reposts_count ?? '-'}</span>
                    <span>评论 ${status.comments_count ?? '-'}</span>
                    <span>赞 ${status.attitudes_count ?? '-'}</span>
                </div>
            `;

        const retweet =
            status.retweeted_status
                ? `
                    <div class="wb-preview-retweet">
                        ${renderStatus(
                            status.retweeted_status,
                            true
                        )}
                    </div>
                `
                : '';

        return `
            <div class="wb-preview-status ${nested ? 'nested' : ''}">
                <div class="wb-preview-user">
                    ${
                        avatar
                            ? `
                                <img
                                    class="wb-preview-avatar"
                                    src="${escapeHtml(avatar)}"
                                >
                            `
                            : ''
                    }

                    <div class="wb-preview-userinfo">
                        <div class="wb-preview-author">
                            ${escapeHtml(author)}
                        </div>

                        <div class="wb-preview-meta">
                            ${escapeHtml(date)}
                            ${
                                source
                                    ? `　${source}`
                                    : ''
                            }
                        </div>
                    </div>
                </div>

                <div class="wb-preview-text">
                    ${sanitizeWeiboHtml(text)}
                </div>

                ${renderPictures(status)}
                ${renderVideo(status)}
                ${retweet}
                ${stats}
            </div>
        `;
    }

    // =========================================================
    // 预览框
    // =========================================================

    function createPreview() {
        let preview =
            document.getElementById(PREVIEW_ID);

        if (preview) {
            return preview;
        }

        preview =
            document.createElement('div');

        preview.id = PREVIEW_ID;

        preview.innerHTML = `
            <div class="wb-preview-content"></div>
        `;

        document.body.appendChild(preview);

        preview.addEventListener(
            'mouseenter',
            () => {
                clearTimeout(hideTimer);
            }
        );

        preview.addEventListener(
            'mouseleave',
            scheduleHide
        );

        return preview;
    }

    function positionPreview(
        preview,
        target
    ) {
        const rect =
            target.getBoundingClientRect();

        const gap = 12;

        const width =
            Math.min(
                480,
                window.innerWidth - 30
            );

        preview.style.width =
            `${width}px`;

        /*
         * 先放按钮右侧
         */
        let left =
            rect.right + gap;

        /*
         * 右侧不够就放左侧
         */
        if (
            left + width >
            window.innerWidth - 10
        ) {
            left =
                rect.left -
                width -
                gap;
        }

        if (left < 10) {
            left = 10;
        }

        let top =
            rect.top - 80;

        if (top < 10) {
            top = 10;
        }

        preview.style.left =
            `${left}px`;

        preview.style.top =
            `${top}px`;
    }

    async function showPreview(
        target,
        mid
    ) {
        const preview =
            createPreview();

        const content =
            preview.querySelector(
                '.wb-preview-content'
            );

        clearTimeout(hideTimer);

        currentMid = mid;

        const myToken =
            ++requestToken;

        positionPreview(
            preview,
            target
        );

        preview.style.display =
            'block';

        content.innerHTML = `
            <div class="wb-preview-loading">
                正在加载微博…
            </div>
        `;

        try {
            const status =
                await fetchStatus(mid);

            if (
                myToken !== requestToken ||
                currentMid !== mid
            ) {
                return;
            }

            content.innerHTML = `
                <a
                    class="wb-preview-open"
                    href="${mobileUrl(mid)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    在微博中打开 ↗
                </a>

                ${renderStatus(status)}
            `;

        } catch (err) {
            if (
                myToken !== requestToken
            ) {
                return;
            }

            content.innerHTML = `
                <div class="wb-preview-error">
                    <strong>预览加载失败</strong>
                    <div>
                        ${escapeHtml(
                            err.message ||
                            String(err)
                        )}
                    </div>

                    <a
                        href="${mobileUrl(mid)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        直接打开微博
                    </a>
                </div>
            `;
        }
    }

    function scheduleShow(
        target,
        mid
    ) {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);

        showTimer =
            setTimeout(
                () => {
                    showPreview(
                        target,
                        mid
                    );
                },
                SHOW_DELAY
            );
    }

    function hidePreview() {
        requestToken++;
        currentMid = null;

        const preview =
            document.getElementById(
                PREVIEW_ID
            );

        if (preview) {
            preview.style.display =
                'none';
        }
    }

    function scheduleHide() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);

        hideTimer =
            setTimeout(
                hidePreview,
                HIDE_DELAY
            );
    }

    // =========================================================
    // 处理“查看二维码”
    // =========================================================

    function processQr(qr) {
        const mid =
            extractMid(qr);

        if (!mid) {
            return;
        }

        /*
         * 隐藏原“查看二维码”
         */
        qr.style.display = 'none';

        const parent =
            qr.parentElement;

        if (!parent) {
            return;
        }

        /*
         * recycle scroller 可能复用 DOM，
         * 所以已有按钮时更新 mid 即可。
         */
        let direct =
            parent.querySelector(
                `.${DIRECT_CLASS}`
            );

        if (!direct) {
            direct =
                document.createElement('a');

            direct.className =
                DIRECT_CLASS;

            direct.target =
                '_blank';

            direct.rel =
                'noopener noreferrer';

            direct.textContent =
                '直接查看';

            qr.insertAdjacentElement(
                'afterend',
                direct
            );

            direct.addEventListener(
                'mouseenter',
                () => {
                    const value =
                        direct.dataset.mid;

                    if (value) {
                        scheduleShow(
                            direct,
                            value
                        );
                    }
                }
            );

            direct.addEventListener(
                'mouseleave',
                scheduleHide
            );

            direct.addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                }
            );
        }

        direct.dataset.mid =
            mid;

        direct.href =
            mobileUrl(mid);
    }

    function process() {
        document
            .querySelectorAll(
                'a[qrcode]'
            )
            .forEach(processQr);
    }

    // =========================================================
    // CSS
    // =========================================================

    function installStyle() {
        const style =
            document.createElement('style');

        style.textContent = `
            .${DIRECT_CLASS} {
                margin-left: 4px;
                color: #ff8200 !important;
                cursor: pointer;
                text-decoration: none !important;
                font-size: inherit;
            }

            .${DIRECT_CLASS}:hover {
                text-decoration: underline !important;
            }

            #${PREVIEW_ID} {
                position: fixed;
                display: none;

                max-height: 76vh;

                overflow-y: auto;
                overflow-x: hidden;

                background: #fff;
                color: #222;

                border:
                    1px solid rgba(0,0,0,.12);

                border-radius: 10px;

                box-shadow:
                    0 10px 35px
                    rgba(0,0,0,.24);

                z-index: 2147483646;

                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    "PingFang SC",
                    "Microsoft YaHei",
                    sans-serif;
            }

            .wb-preview-content {
                box-sizing: border-box;
                padding: 16px;
            }

            .wb-preview-loading,
            .wb-preview-error {
                padding: 28px 12px;
                text-align: center;
                color: #888;
            }

            .wb-preview-error div {
                margin: 10px 0;
            }

            .wb-preview-open {
                display: block;
                margin-bottom: 12px;
                text-align: right;
                color: #ff8200 !important;
                text-decoration: none;
                font-size: 13px;
            }

            .wb-preview-user {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }

            .wb-preview-avatar {
                width: 42px;
                height: 42px;
                flex: none;
                border-radius: 50%;
                object-fit: cover;
                margin-right: 10px;
            }

            .wb-preview-userinfo {
                min-width: 0;
            }

            .wb-preview-author {
                font-weight: 600;
                font-size: 15px;
                color: #222;
            }

            .wb-preview-meta {
                margin-top: 3px;
                color: #999;
                font-size: 12px;
            }

            .wb-preview-meta a {
                color: #999 !important;
                text-decoration: none;
            }

            .wb-preview-text {
                font-size: 15px;
                line-height: 1.7;
                overflow-wrap: anywhere;
            }

            .wb-preview-text a {
                color: #eb7350 !important;
                text-decoration: none;
            }

            .wb-preview-text img {
                max-height: 1.4em;
                vertical-align: middle;
            }

            .wb-preview-pics {
                display: grid;
                grid-template-columns:
                    repeat(3, 1fr);

                gap: 4px;

                margin-top: 12px;
            }

            .wb-preview-pic {
                display: block;
                aspect-ratio: 1 / 1;
                overflow: hidden;
                border-radius: 5px;
                background: #f2f2f2;
            }

            .wb-preview-pic img {
                width: 100%;
                height: 100%;
                display: block;
                object-fit: cover;
            }

            .wb-preview-pics.single {
                display: block;
            }

            .wb-preview-pics.single
            .wb-preview-pic {
                width: auto;
                max-width: 100%;
                aspect-ratio: auto;
            }

            .wb-preview-pics.single
            .wb-preview-pic img {
                width: auto;
                max-width: 100%;
                height: auto;
                max-height: 500px;
                object-fit: contain;
            }

            .wb-preview-video {
                margin-top: 12px;
                border-radius: 7px;
                overflow: hidden;
                background: #000;
            }

            .wb-preview-video video,
            .wb-preview-video img {
                display: block;
                width: 100%;
                max-height: 500px;
                object-fit: contain;
            }

            .wb-preview-retweet {
                margin-top: 12px;
                padding: 12px;

                background: #f7f7f7;

                border-radius: 7px;
            }

            .wb-preview-retweet
            .wb-preview-avatar {
                width: 32px;
                height: 32px;
            }

            .wb-preview-retweet
            .wb-preview-author {
                font-size: 14px;
            }

            .wb-preview-retweet
            .wb-preview-text {
                font-size: 14px;
            }

            .wb-preview-stats {
                display: flex;
                gap: 18px;

                margin-top: 14px;
                padding-top: 10px;

                border-top:
                    1px solid #eee;

                color: #999;
                font-size: 12px;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // =========================================================
    // 初始化
    // =========================================================

    installStyle();
    process();

    let observerTimer = null;

    const observer =
        new MutationObserver(() => {
            clearTimeout(
                observerTimer
            );

            observerTimer =
                setTimeout(
                    process,
                    80
                );
        });

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    /*
     * 微博的虚拟列表会重复利用 DOM，
     * 再用低频扫描兜底。
     */
    setInterval(
        process,
        1500
    );

    /*
     * 页面滚动时隐藏，
     * 防止预览框和原条目错位。
     */
    window.addEventListener(
        'scroll',
        hidePreview,
        {
            passive: true,
            capture: true
        }
    );
})();