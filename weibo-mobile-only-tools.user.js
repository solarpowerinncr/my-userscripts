// ==UserScript==
// @name         微博受限内容：直接查看 + 收藏管理
// @namespace    weibo-mobile-only-tools
// @version      1.1.0
// @description  为微博“请至手机客户端查看”的内容添加直接查看、收藏和取消收藏；收藏瀑布流支持收藏状态切换
// @updateURL    https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/weibo-mobile-only-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/weibo-mobile-only-tools.user.js
// @author       ChatGPT
// @match        https://weibo.com/*
// @match        https://www.weibo.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      m.weibo.cn
// ==/UserScript==

(() => {
    'use strict';

    const MOBILE_ONLY_TEXT =
        '该内容请至手机客户端查看';

    const BASE62 =
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const DETAIL_BAR_CLASS =
        'wb-mobile-only-actions';

    const DESTROY_CLASS =
        'wb-direct-destroy-fav';

    const FAV_TOGGLE_CLASS =
        'wb-favorite-toggle';

    /*
     * ========================================
     * 微博 BID -> 数字 MID
     *
     * 例如：
     * https://weibo.com/5323456577/FhLpVaFpt
     *
     * BID = FhLpVaFpt
     * ========================================
     */

    function base62Decode(str) {
        let result = 0n;

        for (const ch of str) {
            const value =
                BASE62.indexOf(ch);

            if (value < 0) {
                throw new Error(
                    `非法微博 BID 字符：${ch}`
                );
            }

            result =
                result * 62n +
                BigInt(value);
        }

        return result.toString();
    }

    function bidToMid(bid) {
        let result = '';

        for (
            let end = bid.length;
            end > 0;
            end -= 4
        ) {
            const start =
                Math.max(
                    0,
                    end - 4
                );

            const chunk =
                bid.slice(
                    start,
                    end
                );

            let decoded =
                base62Decode(
                    chunk
                );

            if (start > 0) {
                decoded =
                    decoded.padStart(
                        7,
                        '0'
                    );
            }

            result =
                decoded + result;
        }

        return (
            result.replace(
                /^0+(?=\d)/,
                ''
            ) || '0'
        );
    }

    /*
     * ========================================
     * GM_xmlhttpRequest Promise 封装
     * ========================================
     */

    function gmRequest(options) {
        return new Promise(
            (resolve, reject) => {

                GM_xmlhttpRequest({
                    anonymous: false,
                    timeout: 15000,

                    ...options,

                    onload: resolve,

                    onerror: error => {
                        console.error(
                            '[微博工具] GM 请求失败',
                            error
                        );

                        reject(
                            new Error(
                                '网络请求失败'
                            )
                        );
                    },

                    ontimeout: () => {
                        reject(
                            new Error(
                                '网络请求超时'
                            )
                        );
                    }
                });
            }
        );
    }

    /*
     * ========================================
     * 解析 JSON
     * ========================================
     */

    function parseJsonResponse(response) {
        let data =
            response.response;

        if (
            !data &&
            response.responseText
        ) {
            try {
                data =
                    JSON.parse(
                        response.responseText
                    );
            } catch {
                throw new Error(
                    `服务器返回无法解析的数据：${response.responseText}`
                );
            }
        }

        if (
            typeof data === 'string'
        ) {
            try {
                data =
                    JSON.parse(data);
            } catch {
                throw new Error(
                    `服务器返回无法解析的数据：${data}`
                );
            }
        }

        return data;
    }

    /*
     * ========================================
     * 获取当前 m.weibo.cn 的 st
     * ========================================
     */

    async function getSt() {
        const response =
            await gmRequest({
                method: 'GET',

                url:
                    'https://m.weibo.cn/api/config',

                anonymous: false,

                headers: {
                    Accept:
                        'application/json, text/plain, */*',

                    Referer:
                        'https://m.weibo.cn/'
                },

                responseType:
                    'json'
            });

        const data =
            parseJsonResponse(
                response
            );

        const st =
            data?.data?.st;

        if (!st) {
            console.error(
                '[微博工具] api/config 返回：',
                data
            );

            throw new Error(
                '无法取得 st，请确认当前浏览器已经登录 m.weibo.cn'
            );
        }

        console.log(
            '[微博工具] 已取得 st：',
            st
        );

        return st;
    }

    /*
     * ========================================
     * 收藏 / 取消收藏
     *
     * create:
     * /api/statuses/createfav
     *
     * destroy:
     * /api/statuses/destroyfav
     * ========================================
     */

    async function favoriteAction(
        mid,
        action
    ) {
        const st =
            await getSt();

        const endpoint =
            action === 'create'
                ? 'createfav'
                : 'destroyfav';

        const body =
            new URLSearchParams({
                id: mid,

                st,

                _spr:
                    `screen:${screen.width}x${screen.height}`
            });

        console.log(
            `[微博工具] 准备 ${action}`,
            {
                mid,
                endpoint,
                payload:
                    body.toString()
            }
        );

        const response =
            await gmRequest({
                method:
                    'POST',

                url:
                    `https://m.weibo.cn/api/statuses/${endpoint}`,

                anonymous:
                    false,

                headers: {
                    Accept:
                        'application/json, text/plain, */*',

                    'Content-Type':
                        'application/x-www-form-urlencoded',

                    'X-Requested-With':
                        'XMLHttpRequest',

                    'MWeibo-Pwa':
                        '1',

                    'X-XSRF-TOKEN':
                        st,

                    Origin:
                        'https://m.weibo.cn',

                    Referer:
                        'https://m.weibo.cn/'
                },

                data:
                    body.toString(),

                responseType:
                    'json'
            });

        const data =
            parseJsonResponse(
                response
            );

        console.log(
            `[微博工具] ${action} 返回`,
            {
                mid,
                httpStatus:
                    response.status,

                result:
                    data
            }
        );

        return data;
    }

    /*
     * ========================================
     * UI 基础样式
     * ========================================
     */

    function styleLink(element) {
        Object.assign(
            element.style,
            {
                color:
                    '#ff8200',

                cursor:
                    'pointer',

                textDecoration:
                    'none',

                fontSize:
                    '14px'
            }
        );

        return element;
    }

    /*
     * ========================================
     * 直接查看
     * ========================================
     */

    function makeDirectLink(mid) {
        const link =
            styleLink(
                document.createElement(
                    'a'
                )
            );

        link.textContent =
            '直接查看';

        link.href =
            `https://m.weibo.cn/detail/${mid}`;

        link.target =
            '_blank';

        link.rel =
            'noopener noreferrer';

        link.title =
            '在微博移动网页版打开';

        link.addEventListener(
            'click',
            event => {
                event.stopPropagation();
            }
        );

        return link;
    }

    /*
     * ========================================
     * 普通“收藏”按钮
     *
     * 用于单条正文页。
     * ========================================
     */

    function makeFavoriteLink(mid) {
        const link =
            styleLink(
                document.createElement(
                    'a'
                )
            );

        link.href =
            '#';

        link.textContent =
            '收藏';

        link.style.marginLeft =
            '14px';

        link.addEventListener(
            'click',
            async event => {

                event.preventDefault();
                event.stopPropagation();

                const originalText =
                    link.textContent;

                link.textContent =
                    '收藏中…';

                link.style.pointerEvents =
                    'none';

                try {
                    const result =
                        await favoriteAction(
                            mid,
                            'create'
                        );

                    if (
                        result?.ok !== 1
                    ) {
                        throw new Error(
                            result?.msg ||
                            '收藏失败'
                        );
                    }

                    link.textContent =
                        '已收藏';

                    link.style.color =
                        '#999';

                    setTimeout(
                        () => {
                            link.textContent =
                                '收藏';

                            link.style.color =
                                '#ff8200';

                            link.style.pointerEvents =
                                '';
                        },
                        1200
                    );

                } catch (error) {

                    console.error(
                        '[微博工具] 收藏失败',
                        error
                    );

                    alert(
                        `收藏失败：${error.message}`
                    );

                    link.textContent =
                        originalText;

                    link.style.pointerEvents =
                        '';
                }
            }
        );

        return link;
    }

    /*
     * ========================================
     * 普通“取消收藏”按钮
     *
     * 用于单条正文页。
     * ========================================
     */

    function makeDestroyLink(mid) {
        const link =
            styleLink(
                document.createElement(
                    'a'
                )
            );

        link.className =
            DESTROY_CLASS;

        link.href =
            '#';

        link.textContent =
            '取消收藏';

        link.style.marginLeft =
            '14px';

        link.addEventListener(
            'click',
            async event => {

                event.preventDefault();
                event.stopPropagation();

                if (
                    !confirm(
                        '确定取消收藏这条微博吗？'
                    )
                ) {
                    return;
                }

                const originalText =
                    link.textContent;

                link.textContent =
                    '处理中…';

                link.style.pointerEvents =
                    'none';

                try {
                    const result =
                        await favoriteAction(
                            mid,
                            'destroy'
                        );

                    if (
                        result?.ok !== 1
                    ) {
                        throw new Error(
                            result?.msg ||
                            '取消收藏失败'
                        );
                    }

                    link.textContent =
                        '已取消收藏';

                    link.style.color =
                        '#999';

                    setTimeout(
                        () => {
                            link.textContent =
                                '取消收藏';

                            link.style.color =
                                '#ff8200';

                            link.style.pointerEvents =
                                '';
                        },
                        1200
                    );

                } catch (error) {

                    console.error(
                        '[微博工具] 取消收藏失败',
                        error
                    );

                    alert(
                        `取消收藏失败：${error.message}`
                    );

                    link.textContent =
                        originalText;

                    link.style.pointerEvents =
                        '';
                }
            }
        );

        return link;
    }

    /*
     * ========================================
     * 收藏瀑布流专用：
     *
     * “取消收藏” ↔ “收藏”
     *
     * initialFavorited=true
     * 因为它本来就在收藏列表中。
     * ========================================
     */

    function makeFavoriteToggle(
        mid,
        card,
        initialFavorited = true
    ) {
        const link =
            styleLink(
                document.createElement(
                    'a'
                )
            );

        link.className =
            FAV_TOGGLE_CLASS;

        link.href =
            '#';

        link.style.marginLeft =
            '14px';

        let favorited =
            initialFavorited;

        let busy =
            false;

        function render() {
            link.textContent =
                favorited
                    ? '取消收藏'
                    : '收藏';

            link.style.color =
                '#ff8200';

            link.style.pointerEvents =
                '';

            if (card) {
                card.style.opacity =
                    favorited
                        ? '1'
                        : '0.55';
            }
        }

        render();

        link.addEventListener(
            'click',
            async event => {

                event.preventDefault();
                event.stopPropagation();

                if (busy) {
                    return;
                }

                /*
                 * 只有取消收藏时需要确认。
                 *
                 * 如果刚才误取消，
                 * 点击“收藏”可直接恢复。
                 */
                if (
                    favorited &&
                    !confirm(
                        '确定取消收藏这条微博吗？'
                    )
                ) {
                    return;
                }

                busy =
                    true;

                const oldFavorited =
                    favorited;

                link.textContent =
                    favorited
                        ? '处理中…'
                        : '收藏中…';

                link.style.pointerEvents =
                    'none';

                try {

                    const action =
                        favorited
                            ? 'destroy'
                            : 'create';

                    const result =
                        await favoriteAction(
                            mid,
                            action
                        );

                    if (
                        result?.ok !== 1
                    ) {
                        throw new Error(
                            result?.msg ||
                            (
                                favorited
                                    ? '取消收藏失败'
                                    : '收藏失败'
                            )
                        );
                    }

                    /*
                     * 服务器确认成功后
                     * 才切换本地状态。
                     */
                    favorited =
                        !favorited;

                    if (card) {
                        card.style.opacity =
                            favorited
                                ? '1'
                                : '0.55';
                    }

                    /*
                     * 暂时显示操作结果。
                     */
                    link.textContent =
                        favorited
                            ? '已收藏'
                            : '已取消收藏';

                    link.style.color =
                        '#999';

                    setTimeout(
                        () => {
                            busy =
                                false;

                            render();
                        },
                        800
                    );

                } catch (error) {

                    console.error(
                        '[微博工具] 收藏状态切换失败',
                        {
                            mid,
                            favorited:
                                oldFavorited,
                            error
                        }
                    );

                    alert(
                        `${
                            oldFavorited
                                ? '取消收藏'
                                : '收藏'
                        }失败：${error.message}`
                    );

                    /*
                     * 请求失败，
                     * 保持原状态。
                     */
                    favorited =
                        oldFavorited;

                    busy =
                        false;

                    render();
                }
            }
        );

        return link;
    }

    /*
     * ========================================
     * 场景 1：
     *
     * PC “我的收藏”瀑布流
     *
     * 原 HTML：
     *
     * qrcode=
     * "https://weibo.com/detail/534..."
     *
     * 改为：
     *
     * 直接查看    取消收藏
     *
     * 取消后：
     *
     * 直接查看    收藏
     * ========================================
     */

    function processFavoriteCards() {

        document
            .querySelectorAll(
                'a[qrcode]'
            )
            .forEach(qr => {

                const raw =
                    qr.getAttribute(
                        'qrcode'
                    ) || '';

                const match =
                    raw.match(
                        /weibo\.com\/detail\/(\d+)/
                    );

                if (!match) {
                    return;
                }

                const mid =
                    match[1];

                const card =
                    qr.closest(
                        '.wbpro-scroller-item'
                    ) ||
                    qr.closest(
                        'article'
                    );

                if (card) {
                    card.dataset
                        .weiboMobileOnlyMid =
                        mid;
                }

                /*
                 * 把“查看二维码”
                 * 原地改成“直接查看”。
                 *
                 * textContent 会删除二维码图片。
                 */
                qr.removeAttribute(
                    'qrcode'
                );

                qr.href =
                    `https://m.weibo.cn/detail/${mid}`;

                qr.target =
                    '_blank';

                qr.rel =
                    'noopener noreferrer';

                qr.textContent =
                    '直接查看';

                qr.title =
                    `MID: ${mid}`;

                styleLink(qr);

                qr.addEventListener(
                    'click',
                    event => {
                        event.stopPropagation();
                    }
                );

                /*
                 * 添加可切换：
                 *
                 * 取消收藏 ↔ 收藏
                 */
                const parent =
                    qr.parentElement;

                if (
                    parent &&
                    !parent.querySelector(
                        `.${FAV_TOGGLE_CLASS}`
                    )
                ) {
                    const toggle =
                        makeFavoriteToggle(
                            mid,
                            card,
                            true
                        );

                    qr.insertAdjacentElement(
                        'afterend',
                        toggle
                    );
                }
            });
    }

    /*
     * ========================================
     * 单条微博正文：
     *
     * https://weibo.com/UID/BID
     * ========================================
     */

    function getDetailInfo() {

        const match =
            location.pathname.match(
                /^\/(\d+)\/([0-9A-Za-z]+)\/?$/
            );

        if (!match) {
            return null;
        }

        const uid =
            match[1];

        const bid =
            match[2];

        try {
            return {
                uid,
                bid,

                mid:
                    bidToMid(
                        bid
                    )
            };

        } catch (error) {

            console.error(
                '[微博工具] BID -> MID 失败',
                {
                    bid,
                    error
                }
            );

            return null;
        }
    }

    /*
     * 找到：
     *
     * “该内容请至手机客户端查看”
     */
    function findMobileOnlyTextElement() {

        const walker =
            document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT
            );

        let node;

        while (
            (node = walker.nextNode())
        ) {
            if (
                (
                    node.nodeValue ||
                    ''
                ).includes(
                    MOBILE_ONLY_TEXT
                )
            ) {
                return node.parentElement;
            }
        }

        return null;
    }

    /*
     * ========================================
     * 场景 2：
     *
     * 单条受限微博正文
     *
     * 显示：
     *
     * 直接查看  收藏  取消收藏
     * ========================================
     */

    function processDetailPage() {

        const info =
            getDetailInfo();

        if (!info) {
            return;
        }

        if (
            !document.body.textContent.includes(
                MOBILE_ONLY_TEXT
            )
        ) {
            return;
        }

        const textElement =
            findMobileOnlyTextElement();

        if (!textElement) {
            return;
        }

        /*
         * 兼容微博 SPA 页面切换。
         */
        const oldBar =
            document.querySelector(
                `.${DETAIL_BAR_CLASS}`
            );

        if (oldBar) {

            if (
                oldBar.dataset.mid ===
                info.mid
            ) {
                return;
            }

            oldBar.remove();
        }

        const bar =
            document.createElement(
                'div'
            );

        bar.className =
            DETAIL_BAR_CLASS;

        bar.dataset.mid =
            info.mid;

        Object.assign(
            bar.style,
            {
                marginTop:
                    '14px',

                textAlign:
                    'center',

                lineHeight:
                    '30px'
            }
        );

        /*
         * 直接查看
         */
        bar.appendChild(
            makeDirectLink(
                info.mid
            )
        );

        /*
         * 收藏
         */
        bar.appendChild(
            makeFavoriteLink(
                info.mid
            )
        );

        /*
         * 取消收藏
         */
        bar.appendChild(
            makeDestroyLink(
                info.mid
            )
        );

        textElement.insertAdjacentElement(
            'afterend',
            bar
        );

        console.log(
            '[微博工具] 当前受限正文：',
            {
                uid:
                    info.uid,

                bid:
                    info.bid,

                mid:
                    info.mid
            }
        );
    }

    /*
     * ========================================
     * 总处理
     * ========================================
     */

    function processAll() {
        processFavoriteCards();
        processDetailPage();
    }

    /*
     * ========================================
     * MutationObserver
     *
     * 微博使用 SPA + 瀑布流。
     * ========================================
     */

    let timer =
        null;

    function schedule() {

        clearTimeout(
            timer
        );

        timer =
            setTimeout(
                processAll,
                100
            );
    }

    const observer =
        new MutationObserver(
            schedule
        );

    observer.observe(
        document.documentElement,
        {
            childList:
                true,

            subtree:
                true
        }
    );

    /*
     * ========================================
     * SPA 路由
     * ========================================
     */

    const originalPushState =
        history.pushState;

    history.pushState =
        function (...args) {

            const result =
                originalPushState.apply(
                    this,
                    args
                );

            schedule();

            return result;
        };

    const originalReplaceState =
        history.replaceState;

    history.replaceState =
        function (...args) {

            const result =
                originalReplaceState.apply(
                    this,
                    args
                );

            schedule();

            return result;
        };

    window.addEventListener(
        'popstate',
        schedule
    );

    /*
     * ========================================
     * 启动
     * ========================================
     */

    console.log(
        '[微博工具] 脚本已启动 v1.1.0'
    );

    processAll();

})();
