// ==UserScript==
// @name         Leciel Arcadia: 戦闘詳細・変調内訳
// @namespace    local.leciar-tools
// @version      1.8.0
// @author        logel0
// @contributor   GPT-5.6 (OpenAI Codex)
// @description  【非公式・サイト運営者とは無関係】戦闘詳細の効果内訳を表示します。サイト更新により動作しなくなる場合があります。
// @homepageURL  https://github.com/logel0/leciar-userscripts
// @supportURL   https://github.com/logel0/leciar-userscripts/issues
// @downloadURL  https://logel0.github.io/leciar-userscripts/leciar-battle-mutation-breakdown.user.js
// @match        https://rarirupj.com/leciar/*
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

  // 表示順。数値は「成功して増減・付与された量」の合計。
  const effects = [
    ['猛毒', 'bad'], ['凍結', 'bad'], ['呪縛', 'bad'], ['麻痺', 'bad'],
    ['攻減', 'decrease'], ['守減', 'decrease'], ['速減', 'decrease'], ['阻害', 'warning'],
    ['治癒', 'good'], ['平穏', 'good'], ['祝福', 'good'], ['加護', 'good'],
    ['攻増', 'increase'], ['守増', 'increase'], ['速増', 'increase'], ['保護', 'protect'],
    ['ATK↑', 'stat'], ['DEF↑', 'stat'], ['AGI↑', 'stat'], ['DEX↑', 'stat'],
    ['MHP↑', 'stat'], ['MND↑', 'stat'], ['LUK↑', 'stat'], ['SP↑', 'stat'], ['連続値↑', 'stat'],
    ['ATK↓', 'stat'], ['DEF↓', 'stat'], ['AGI↓', 'stat'], ['DEX↓', 'stat'],
    ['MHP↓', 'stat'], ['MND↓', 'stat'], ['LUK↓', 'stat'], ['SP↓', 'stat'], ['連続値↓', 'stat'],
    ['HATE↑', 'stat'], ['HATE↓', 'stat'],
  ];
  const effectNames = new Set(effects.map(([name]) => name));
  const addClass = 'leciar-mutation-breakdown-added';
  const statusKinds = new Map([
    ...['治癒', '平穏', '祝福', '加護', '保護'].map((name) => [name, 'good']),
    ...['猛毒', '凍結', '呪縛', '麻痺', '阻害'].map((name) => [name, 'bad']),
    ...['攻増', '守増', '速増', '攻減', '守減', '速減'].map((name) => [name, 'status']),
  ]);

  // 保護・阻害で 0 になった試行、経過ターンによる状態変化は集計しない。
  // サイト側のHTMLでは、タグ境界の前後に空白がある場合とない場合が混在する。
  // textContent上の「対象 に 効果 を 1 付与！」と「対象 に 効果 を1付与！」を同様に扱う。
  const grantPattern = /^.+?\s*に\s*(.+?)\s*を\s*(\d+)\s*付与[！!]?$/;
  const changePattern = /^.+?\s+の\s+(ATK|DEF|AGI|DEX|MHP|MND|LUK|HATE|SP|連続値)\s+が\s+(\d+)\s+(増加した|減少した)！?$/;

  function emptyCounts() {
    return Object.fromEntries(effects.map(([name]) => [name, 0]));
  }

  function addCounts(target, name, value) {
    target[name] = (target[name] ?? 0) + value;
  }

  function actorName(text) {
    const match = text.trim().match(/^(.+?)\s*の\s*(?:自動)?行動[！!]/);
    return match?.[1].trim() ?? '';
  }

  function skillName(text) {
    return text.trim().replace(/！+$/, '');
  }

  function skillInfo(element) {
    if (!element) return { display: '', key: '', original: '' };
    const original = element.querySelector('.d-name')?.textContent
      .replace(/[《》]/g, '')
      .trim() ?? '';
    const displayElement = element.cloneNode(true);
    displayElement.querySelector('.d-name')?.remove();
    const display = skillName(displayElement.textContent);
    return { display, key: original || display, original };
  }

  function rowActorName(row) {
    const cell = row.querySelector('.summary-name-cell');
    if (!cell) return '';
    // 追加した内訳要素を含めず、元のキャラクター名だけを取得する。
    const profileLink = cell.querySelector('.battle-unit-profile-link');
    if (profileLink) return profileLink.textContent.replace(/^\s*■\s*/, '').trim();
    const copy = cell.cloneNode(true);
    copy.querySelector(`.${addClass}`)?.remove();
    return copy.textContent.replace(/^\s*■\s*/, '').trim();
  }

  function rowSkillName(row) {
    const cell = row.querySelector('.skill-name-cell');
    if (!cell) return '';
    const copy = cell.cloneNode(true);
    copy.querySelector(`.${addClass}`)?.remove();
    copy.querySelector('.leciar-original-skill-name')?.remove();
    return copy.textContent
      .replace(/^\s*┗\s*/, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim();
  }

  function appendOriginalSkillName(cell, original) {
    if (!cell || !original || cell.querySelector('.leciar-original-skill-name')) return;
    const name = document.createElement('span');
    name.className = 'leciar-original-skill-name';
    name.textContent = ` 《${original}》`;
    name.title = '元スキル名（集計キー）';
    cell.append(name);
  }

  function renderCounts(counts) {
    const fragment = document.createDocumentFragment();
    for (const [name, kind] of effects) {
      const count = counts[name] ?? 0;
      if (!count) continue;
      const badge = document.createElement('span');
      badge.className = `leciar-mutation-badge ${kind}`;
      badge.textContent = `${name} ${count}`;
      fragment.append(badge);
    }
    return fragment;
  }

  function appendBreakdown(cell, counts) {
    if (!cell || cell.querySelector(`.${addClass}`)) return;
    const hasEffect = [...effectNames].some((name) => counts[name] > 0);
    if (!hasEffect) return;

    const box = document.createElement('div');
    box.className = addClass;
    box.title = '成功して付与・増減された効果量の合計（保護・阻害などで0になった試行は含みません）';
    const label = document.createElement('span');
    label.className = 'leciar-mutation-label';
    label.textContent = '効果: ';
    box.append(label, renderCounts(counts));
    cell.append(box);
  }

  function installStyle() {
    if (document.getElementById('leciar-mutation-breakdown-style')) return;
    const style = document.createElement('style');
    style.id = 'leciar-mutation-breakdown-style';
    style.textContent = `
      .${addClass} { margin-top: 3px; font-size: .78em; line-height: 1.5; white-space: normal; }
      .leciar-mutation-label { color: rgba(255,255,255,.68); }
      .leciar-mutation-badge { display: inline-block; margin: 1px 3px 1px 0; padding: 0 4px; border-radius: 3px; font-size: .95em; }
      .leciar-mutation-badge.good { color: #a9edc1; background: rgba(60,150,94,.2); }
      .leciar-mutation-badge.bad { color: #ffaaa8; background: rgba(190,70,68,.2); }
      .leciar-mutation-badge.protect { color: #a8d8ff; background: rgba(50,125,210,.24); }
      .leciar-mutation-badge.warning { color: #ffe17a; background: rgba(175,135,10,.24); }
      .leciar-mutation-badge.increase { color: #ffbf84; background: rgba(205,105,25,.22); }
      .leciar-mutation-badge.decrease { color: #d3b2ff; background: rgba(120,70,185,.24); }
      .leciar-mutation-badge.stat { color: #f3f3f3; background: rgba(255,255,255,.12); }
      .leciar-original-skill-name { color: rgba(255,255,255,.62); font-size: .9em; }
      .leciar-mutation-impact-panel { margin-top: 12px; }
      .leciar-mutation-impact-panel .battle-summary-table { white-space: nowrap; }
      .leciar-mutation-impact-panel .battle-summary-table th:not(:last-child),
      .leciar-mutation-impact-panel .battle-summary-table td:not(:last-child) { border-right: 1px solid rgba(255,255,255,.14); }
      .leciar-mutation-impact-panel .total { font-weight: 700; }
      .leciar-mutation-impact-note { margin: 7px 0 0; color: rgba(255,255,255,.7); font-size: .85em; }
      .leciar-impact-positive { color: #a9edc1; }
      .leciar-impact-negative { color: #ffaaa8; }
      .leciar-status-kind { box-sizing: border-box; border: 2px solid transparent; border-radius: 5px; }
      .leciar-status-kind-good { background: rgba(46, 160, 90, .72) !important; border-color: #8ce8ac; }
      .leciar-status-kind-bad { background: rgba(190, 55, 58, .72) !important; border-color: #ff9b99; }
      .leciar-status-kind-status { background: rgba(190, 137, 24, .75) !important; border-color: #ffe08a; }
      .leciar-status-legend { margin: 6px 0 10px; font-size: .78em; color: rgba(255,255,255,.82); }
      .leciar-status-legend span { display: inline-block; margin-right: 8px; padding: 1px 6px; border-radius: 4px; }
      .leciar-status-legend .good { background: rgba(46, 160, 90, .72); }
      .leciar-status-legend .bad { background: rgba(190, 55, 58, .72); }
      .leciar-status-legend .status { background: rgba(190, 137, 24, .75); }
    `;
    document.head.append(style);
  }

  function collect() {
    const byActor = new Map();
    const byActorAndSkill = new Map();
    const originalByActorAndDisplay = new Map();

    function registerSkillName(actor, info) {
      if (!actor || !info.display || !info.key) return;
      const aliasKey = `${actor}\u0000${info.display}`;
      const originals = originalByActorAndDisplay.get(aliasKey) ?? new Set();
      originals.add(info.key);
      originalByActorAndDisplay.set(aliasKey, originals);
    }

    function recordEffects(event, name, skill) {
      if (!event || !name || !skill) return;
      const actorCounts = byActor.get(name) ?? emptyCounts();
      const skillKey = `${name}\u0000${skill}`;
      const skillCounts = byActorAndSkill.get(skillKey) ?? emptyCounts();

      for (const result of event.querySelectorAll('.result')) {
        // 通常行動の途中にはパッシブやチェインが挟み込まれることがある。
        // 各 result は最も近いイベント要素だけに帰属させ、親スキルへの混入と二重計上を防ぐ。
        const owner = result.closest('.passive-text, .link-action, .action');
        if (owner !== event) continue;
        const text = result.textContent.trim();
        const granted = text.match(grantPattern);
        const changed = text.match(changePattern);
        const effect = granted?.[1] ?? (changed ? `${changed[1]}${changed[3] === '増加した' ? '↑' : '↓'}` : '');
        const amount = Number(granted?.[2] ?? changed?.[2]);
        if (!effectNames.has(effect) || !Number.isFinite(amount) || amount <= 0) continue;
        addCounts(actorCounts, effect, amount);
        addCounts(skillCounts, effect, amount);
      }

      byActor.set(name, actorCounts);
      byActorAndSkill.set(skillKey, skillCounts);
    }

    // 与回復後などは .nested-passive > .passive-text に入る。
    // actor 全体をたどるのではなく、各 passive-text を1イベントとして処理する。
    for (const event of document.querySelectorAll('.passive-text')) {
      const actor = event.querySelector(':scope > .actor');
      const name = actorName(actor?.textContent ?? '');
      const info = skillInfo(event.querySelector('.skill-name, .skill-name-enemy'));
      registerSkillName(name, info);
      recordEffects(event, name, info.key);
    }

    // 通常行動は turn 直下の action のみを対象にする。
    // nested-passive とチェインはそれぞれ別の処理に任せ、元スキルへ混ぜない。
    for (const turn of document.querySelectorAll('.turn')) {
      const actor = turn.querySelector(':scope > .actor');
      const action = turn.querySelector(':scope > .checkactions > .action');
      const name = actorName(actor?.textContent ?? '');
      const info = skillInfo(action?.querySelector('.skill-name, .skill-name-enemy'));
      registerSkillName(name, info);
      recordEffects(action, name, info.key);
    }

    for (const chainAction of document.querySelectorAll('.link-action')) {
      const actorText = chainAction.querySelector('.actor')?.textContent ?? '';
      // 「行動者 と 連携相手 のチェインスキル！」の先頭がチェイン発動者。
      const chainActor = actorText.match(/^(.+?)\s*と\s*.+?\s*のチェインスキル[！!]/)?.[1].trim() ?? '';
      const info = { display: 'チェインスキル', key: 'チェインスキル', original: '' };
      registerSkillName(chainActor, info);
      recordEffects(chainAction, chainActor, info.key);
    }
    return { byActor, byActorAndSkill, originalByActorAndDisplay };
  }

  function emptyImpact() {
    return {
      peaceContinuous: 0,
      freezeContinuous: 0,
      healingReceived: 0,
      poisonDamage: 0,
      protectionBlocks: 0,
      obstructionBlocks: 0,
      protectionEffects: new Map(),
      obstructionEffects: new Map(),
    };
  }

  function addImpact(target, field, amount) {
    target[field] += amount;
  }

  // 変調の経過処理は付与元スキルと結び付かないため、受け手ごとの実効果だけを集計する。
  function collectMutationImpacts() {
    const byUnit = new Map();
    const patterns = [
      ['peaceContinuous', /^(.+?)\s*は\s*平穏\s*により連続値が\s*(\d+)\s*増加した！/],
      ['freezeContinuous', /^(.+?)\s*は\s*凍結\s*により連続値が\s*(\d+)\s*減少した！/],
      ['healingReceived', /^(.+?)\s*は\s*治癒\s*により\s*(\d+)\s*回復した！/],
      ['poisonDamage', /^(.+?)\s*は\s*猛毒\s*により\s*(\d+)\s*のダメージを受けた！/],
    ];

    for (const result of document.querySelectorAll('.depth-result')) {
      const text = result.textContent.replace(/\s+/g, ' ').trim();
      for (const [field, pattern] of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const unit = match[1].trim();
        const amount = Number(match[2]);
        if (!unit || !Number.isFinite(amount) || amount <= 0) continue;
        const impact = byUnit.get(unit) ?? emptyImpact();
        addImpact(impact, field, amount);
        byUnit.set(unit, impact);
        break;
      }
    }
    return byUnit;
  }

  // 「保護/阻害で無効化」の直後に出る 0 付与行を1回の防止として数える。
  // 付与量ではなく、実際に防いだ試行回数と効果名を対象ごとに記録する。
  function collectPreventedEffects(byUnit) {
    const blockedPattern = /^(保護|阻害)\s*により次の効果が無効化された/;
    const zeroGrantPattern = /^(.+?)\s*に\s*(.+?)\s*を\s*0\s*付与[！!]?$/;

    for (const result of document.querySelectorAll('.result')) {
      const blocker = result.textContent.replace(/\s+/g, ' ').trim().match(blockedPattern)?.[1];
      if (!blocker) continue;
      const next = result.nextElementSibling;
      if (!next?.classList.contains('result')) continue;
      const grant = next.textContent.replace(/\s+/g, ' ').trim().match(zeroGrantPattern);
      if (!grant) continue;

      const unit = grant[1].trim();
      const effect = grant[2].trim();
      if (!unit || !effect) continue;
      const impact = byUnit.get(unit) ?? emptyImpact();
      const countField = blocker === '保護' ? 'protectionBlocks' : 'obstructionBlocks';
      const effectsField = blocker === '保護' ? 'protectionEffects' : 'obstructionEffects';
      impact[countField] += 1;
      impact[effectsField].set(effect, (impact[effectsField].get(effect) ?? 0) + 1);
      byUnit.set(unit, impact);
    }
    return byUnit;
  }

  function addImpactValues(target, source) {
    for (const field of ['peaceContinuous', 'freezeContinuous', 'healingReceived', 'poisonDamage', 'protectionBlocks', 'obstructionBlocks']) {
      target[field] += source[field] ?? 0;
    }
    for (const field of ['protectionEffects', 'obstructionEffects']) {
      for (const [effect, count] of source[field] ?? []) {
        target[field].set(effect, (target[field].get(effect) ?? 0) + count);
      }
    }
  }

  function battleTurns() {
    const turns = [...document.querySelectorAll('.round-count')]
      .map((node) => Number(node.textContent.trim()))
      .filter(Number.isFinite);
    return turns.length ? Math.max(...turns) : 0;
  }

  function impactCell(value, className, turns, prefix = '') {
    const cell = document.createElement('td');
    cell.className = className;
    const perTurn = turns ? Math.ceil((value / turns) * 10) / 10 : 0;
    const averagePrefix = prefix || '+';
    cell.textContent = `${prefix}${value.toLocaleString('ja-JP')} (${averagePrefix}${perTurn.toFixed(1)}/t)`;
    return cell;
  }

  function blockedCell(count, effects, className) {
    const cell = document.createElement('td');
    cell.className = className;
    cell.textContent = `${count.toLocaleString('ja-JP')}回`;
    if (effects.size) {
      cell.title = [...effects.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
        .map(([effect, value]) => `${effect} ${value}回`)
        .join(' / ');
    }
    return cell;
  }

  function impactRow(name, impact, turns, className = '') {
    const row = document.createElement('tr');
    if (className) row.className = className;
    const label = document.createElement('td');
    label.textContent = name;
    row.append(
      label,
      impactCell(impact.peaceContinuous, 'leciar-impact-positive', turns, '+'),
      impactCell(impact.freezeContinuous, 'leciar-impact-negative', turns, '−'),
      impactCell(impact.healingReceived, 'leciar-impact-positive', turns, '+'),
      impactCell(impact.poisonDamage, 'leciar-impact-negative', turns, '−'),
      blockedCell(impact.protectionBlocks, impact.protectionEffects, 'leciar-impact-positive'),
      blockedCell(impact.obstructionBlocks, impact.obstructionEffects, 'leciar-impact-negative'),
    );
    return row;
  }

  function appendImpactPanel(byUnit) {
    if (document.getElementById('leciar-mutation-impact-panel') || !byUnit.size) return;
    const summaryTable = document.querySelector('.battle-summary-table');
    const summaryWrap = summaryTable?.closest('.battle-summary-table-wrap');
    if (!summaryWrap) return;

    const unitRows = [...document.querySelectorAll('tr.ally-row, tr.enemy-row')]
      .map((row) => ({ name: rowActorName(row), side: row.classList.contains('ally-row') ? 'ally' : 'enemy' }))
      .filter(({ name }) => byUnit.has(name));
    const allyTotal = emptyImpact();
    const enemyTotal = emptyImpact();
    for (const { name, side } of unitRows) addImpactValues(side === 'ally' ? allyTotal : enemyTotal, byUnit.get(name));
    const turns = battleTurns();

    const panel = document.createElement('div');
    panel.id = 'leciar-mutation-impact-panel';
    panel.className = 'battle-summary-table-wrap leciar-mutation-impact-panel';
    const note = document.createElement('p');
    note.className = 'leciar-mutation-impact-note';
    note.textContent = '実効果は受け手ごとに合算。保護・阻害は「無効化」の直後に0付与された効果を1回として数え、セルにマウスを重ねると内訳を表示します。';
    const table = document.createElement('table');
    table.className = 'battle-summary-table';
    const head = document.createElement('thead');
    const group = document.createElement('tr');
    group.className = 'group-row';
    const groupLabel = document.createElement('th');
    groupLabel.colSpan = 7;
    groupLabel.textContent = '変調・保護・阻害による実効果';
    group.append(groupLabel);
    const header = document.createElement('tr');
    for (const text of ['対象', '平穏：連続値', '凍結：連続値', '治癒：被回復', '猛毒：被ダメ', '保護：防止', '阻害：防止']) {
      const cell = document.createElement('th');
      cell.textContent = text;
      header.append(cell);
    }
    head.append(group, header);
    const body = document.createElement('tbody');
    const allies = unitRows.filter(({ side }) => side === 'ally');
    const enemies = unitRows.filter(({ side }) => side === 'enemy');
    body.append(impactRow('味方合計', allyTotal, turns, 'total'));
    for (const { name } of allies) body.append(impactRow(name, byUnit.get(name), turns));
    body.append(impactRow('敵合計', enemyTotal, turns, 'total'));
    for (const { name } of enemies) body.append(impactRow(name, byUnit.get(name), turns));
    table.append(head, body);
    panel.append(table, note);
    summaryWrap.insertAdjacentElement('afterend', panel);
  }

  function applyStatusIconColors() {
    const states = document.querySelectorAll('.status-icon-area .state[data-tooltip]');
    if (!states.length) return;
    for (const state of states) {
      const name = state.dataset.tooltip?.trim() ?? '';
      const kind = statusKinds.get(name);
      if (!kind) continue;
      state.classList.add('leciar-status-kind', `leciar-status-kind-${kind}`);
      state.title = `${kind === 'good' ? '良性' : kind === 'bad' ? '悪性' : '能力変化'}：${name}`;
    }

    if (document.querySelector('.leciar-status-legend')) return;
    const anchor = document.querySelector('.battle-start-call, .battle-result');
    if (!anchor) return;
    const legend = document.createElement('div');
    legend.className = 'leciar-status-legend';
    for (const [kind, label] of [['good', '良性'], ['bad', '悪性'], ['status', '能力変化']]) {
      const item = document.createElement('span');
      item.className = kind;
      item.textContent = label;
      legend.append(item);
    }
    anchor.insertAdjacentElement('afterend', legend);
  }

  function apply() {
    if (!document.querySelector('.battle-result')) return;
    installStyle();
    applyStatusIconColors();
    const { byActor, byActorAndSkill, originalByActorAndDisplay } = collect();
    appendImpactPanel(collectPreventedEffects(collectMutationImpacts()));

    for (const row of document.querySelectorAll('tr.ally-row, tr.enemy-row')) {
      appendBreakdown(row.querySelector('.summary-name-cell'), byActor.get(rowActorName(row)) ?? emptyCounts());
    }

    let currentActor = '';
    for (const row of document.querySelectorAll('tr.ally-row, tr.enemy-row, tr.skill-detail-row')) {
      if (!row.classList.contains('skill-detail-row')) {
        currentActor = rowActorName(row);
        continue;
      }
      const display = rowSkillName(row);
      const originals = originalByActorAndDisplay.get(`${currentActor}\u0000${display}`);
      // 同じ変更名を複数の元スキルに付けた場合は、誤った合算を避けて表示しない。
      const original = originals?.size === 1 ? [...originals][0] : display;
      const cell = row.querySelector('.skill-name-cell');
      if (originals?.size === 1 && original !== display) appendOriginalSkillName(cell, original);
      appendBreakdown(cell, byActorAndSkill.get(`${currentActor}\u0000${original}`) ?? emptyCounts());
    }
  }

  apply();
})();
