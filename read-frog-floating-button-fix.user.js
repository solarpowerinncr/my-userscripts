// ==UserScript==
// @name         Read Frog 悬浮按钮触控拖动修复
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  修复 Read Frog 扩展在触控/Device Toolbar模拟下悬浮按钮因缺少 touch-action 而被浏览器滚动取消的问题
// @updateURL    https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/read-frog-floating-button-fix.user.js
// @downloadURL  https://raw.githubusercontent.com/solarpowerinncr/my-userscripts/master/read-frog-floating-button-fix.user.js
// @author       Antigravity
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // 待注入 Shadow DOM 的核心样式
  const FIX_CSS = `
    /* 关键：确保悬浮按钮及容器在触碰前即具备 touch-action: none，阻止浏览器识别为页面滚动 */
    [data-testid="floating-main-button"],
    [data-testid="floating-button-container"],
    [data-testid="floating-main-button"] * {
      touch-action: none !important;
      -webkit-user-drag: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }

    /* 保证内部小青蛙图标不拦截指针事件，让事件直接命中按钮容器 */
    [data-testid="floating-main-button"] img {
      pointer-events: none !important;
      -webkit-user-drag: none !important;
    }
  `;

  const patchedShadowRoots = new WeakSet();

  function patchShadowRoot(shadowRoot) {
    if (!shadowRoot || patchedShadowRoots.has(shadowRoot)) return;
    patchedShadowRoots.add(shadowRoot);

    // 1. 注入专用样式表穿透 Shadow DOM
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-source', 'read-frog-touch-fix');
    styleEl.textContent = FIX_CSS;
    shadowRoot.appendChild(styleEl);

    // 2. 绑定非被动的 touchmove 阻止页面滚动抢占
    function bindButtonTouchFix() {
      const button = shadowRoot.querySelector('[data-testid="floating-main-button"]');
      if (button && !button.__rfTouchFixAttached) {
        button.__rfTouchFixAttached = true;
        button.style.touchAction = 'none';

        button.addEventListener(
          'touchmove',
          function (e) {
            // 阻止浏览器原生的页面滚动行为，保障 Pointer Events 顺畅派发
            e.preventDefault();
          },
          { passive: false }
        );
      }
    }

    bindButtonTouchFix();

    // 3. 监听 Shadow DOM 内部 React 组件重渲染
    const shadowObserver = new MutationObserver(() => {
      // 样式若被清除则补回
      if (!shadowRoot.querySelector('style[data-source="read-frog-touch-fix"]')) {
        shadowRoot.appendChild(styleEl.cloneNode(true));
      }
      bindButtonTouchFix();
    });

    shadowObserver.observe(shadowRoot, { childList: true, subtree: true });
  }

  function checkAndPatchHost(element) {
    if (element && element.tagName && element.tagName.toLowerCase() === 'read-frog') {
      element.style.touchAction = 'none';
      if (element.shadowRoot) {
        patchShadowRoot(element.shadowRoot);
      }
    }
  }

  // 页面既有元素检查
  function scanExisting() {
    document.querySelectorAll('read-frog').forEach(checkAndPatchHost);
  }

  // 监听 DOM 树变化以捕获动态插入的 <read-frog>
  const pageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          checkAndPatchHost(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('read-frog').forEach(checkAndPatchHost);
          }
        }
      }
    }
  });

  pageObserver.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });

  // 文档加载时尝试初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanExisting);
  } else {
    scanExisting();
  }
})();
