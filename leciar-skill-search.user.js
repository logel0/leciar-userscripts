// ==UserScript==
// @name         Leciel Arcadia: スキルからキャラクター検索
// @namespace    local.leciar-tools
// @version      1.0.3
// @author        logel0
// @contributor   GPT-5.6 (OpenAI Codex)
// @description  【非公式・サイト運営者とは無関係】スキル名を所持キャラクター検索へのリンクにします。サイト更新により動作しなくなる場合があります。
// @homepageURL  https://github.com/logel0/leciar-userscripts
// @supportURL   https://github.com/logel0/leciar-userscripts/issues
// @downloadURL  https://logel0.github.io/leciar-userscripts/leciar-skill-search.user.js
// @match        https://rarirupj.com/leciar/thread*
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

  // @match はクエリ文字列で絞れないため、スキル一覧以外では何もしない。
  if (new URLSearchParams(location.search).get('page') !== 'skills') return;

  const searchPath = '/leciar/characters/search';
  const skillCells = document.querySelectorAll('.skill-catalog .catalog-data-row > td:first-child');

  for (const cell of skillCells) {
    // ページ側の将来の変更や二重実行でも、既存のリンクを壊さない。
    if (cell.querySelector('a[data-leciar-skill-search]')) continue;

    const skillName = cell.textContent.trim();
    if (!skillName) continue;

    const url = new URL(searchPath, location.origin);
    url.search = new URLSearchParams({ skill: skillName });

    const link = document.createElement('a');
    link.dataset.leciarSkillSearch = 'true';
    link.href = url.href;
    link.textContent = skillName;
    link.title = `「${skillName}」を所持するキャラクターを検索`;
    link.style.color = 'inherit';
    link.style.textDecoration = 'underline';
    link.style.textDecorationStyle = 'dotted';
    link.style.textUnderlineOffset = '0.18em';
    link.style.cursor = 'pointer';

    cell.replaceChildren(link);
  }
})();
