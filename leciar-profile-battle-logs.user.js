// ==UserScript==
// @name         Leciel Arcadia: キャラクターの戦闘結果一覧
// @namespace    local.leciar-tools
// @version      1.0.3
// @author        logel0
// @contributor   GPT-5.6 (OpenAI Codex)
// @description  【非公式・サイト運営者とは無関係】キャラクターの戦闘結果一覧ボタンを追加します。サイト更新により動作しなくなる場合があります。
// @homepageURL  https://github.com/logel0/leciar-userscripts
// @supportURL   https://github.com/logel0/leciar-userscripts/issues
// @downloadURL  https://logel0.github.io/leciar-userscripts/leciar-profile-battle-logs.user.js
// @match        https://rarirupj.com/leciar/profile*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Leciel Arcadia 非公式ツール
 * 本スクリプトはサイト運営者とは無関係です。サイトの更新により動作しなくなる可能性があります。
 * MIT License により、自由な利用・改変・再配布が可能です。詳細は同梱のライセンスファイルを参照してください。
 * 本スクリプトは無保証で提供され、利用によって生じた損害について作者は責任を負いません。
 */

(() => {
  'use strict';

  if (location.pathname !== '/leciar/profile') return;

  const relation = document.querySelector('.profile-relation');
  if (!relation || relation.querySelector('[data-leciar-profile-battle-logs]')) return;

  // URL の ENo を優先し、取得できない場合はプロフィール見出しから補う。
  const enoFromUrl = new URL(location.href).searchParams.get('ENo');
  const enoFromTitle = document.querySelector('.profile-header-title')?.textContent
    .match(/\bENo\.(\d+)\b/)?.[1];
  const eno = /^\d+$/.test(enoFromUrl ?? '') ? enoFromUrl : enoFromTitle;
  if (!eno) return;

  const url = new URL('/leciar/logs', location.origin);
  url.search = new URLSearchParams({
    target: eno,
    title: '',
    mode: 'member',
    results: '',
  });

  const link = document.createElement('a');
  link.dataset.leciarProfileBattleLogs = 'true';
  link.className = 'profile-relation-button button';
  link.href = url.href;
  link.textContent = '戦闘結果一覧';
  link.title = `ENo.${eno} を含む戦闘結果一覧を開く`;
  relation.append(link);
})();
