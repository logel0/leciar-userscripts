// ==UserScript==
// @name         Leciel Arcadia: SP・変調推移 [Beta]
// @namespace    local.leciar-tools.beta
// @version      0.2.0-beta.7
// @author        logel0
// @contributor   GPT-5.6 (OpenAI Codex)
// @description  【Beta・非公式・サイト運営者とは無関係】戦闘中のSPと変調深度をターンごとに表示します。サイト更新により動作しなくなる場合があります。
// @homepageURL  https://github.com/logel0/leciar-userscripts
// @supportURL   https://github.com/logel0/leciar-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/logel0/leciar-userscripts/beta/leciar-sp-mutation-timeline.user.js
// @updateURL    https://raw.githubusercontent.com/logel0/leciar-userscripts/beta/leciar-sp-mutation-timeline.user.js
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

  const goodEffects = [
    ['he', '治癒'], ['sh', '祝福'], ['k', '加護'],
  ];
  const badEffects = [
    ['p', '猛毒'], ['c', '呪縛'], ['pa', '麻痺'],
  ];
  const protectionEffects = [
    ['y', '保護'], ['so', '阻害'],
  ];
  const progressingEffects = new Map([
    ['猛毒', 'p'], ['凍結', 'f'], ['呪縛', 'c'], ['麻痺', 'pa'],
    ['治癒', 'he'], ['平穏', 'pe'], ['祝福', 'sh'], ['加護', 'k'],
  ]);

  function unitInfo() {
    return [...document.querySelectorAll('section.wide-unit[id^="index"][id$="u"]')]
      .map((section) => {
        const match = section.id.match(/^index(\d+)u$/);
        if (!match) return null;
        const spTitle = section.querySelector('.sp-gauge-wrapper')?.title ?? '';
        return {
          id: Number(match[1]),
          name: section.querySelector('.unit-name-position')?.textContent.trim() || `Unit ${match[1]}`,
          side: section.classList.contains('allie') ? '味方' : '敵',
          initial: {
            i: Number(match[1]),
            s: Number(spTitle.match(/SP\s+(\d+)/)?.[1] ?? 0),
          },
        };
      })
      .filter(Boolean);
  }

  function officialBattleData() {
    const records = Array.isArray(window.roundSections) ? window.roundSections : [];
    const sources = Array.isArray(window.paramSource) ? window.paramSource : [];
    if (!records.length || !sources.length) return null;
    // TURN境界では同じparameters番号が公式の索引へ複数回入る場合がある。
    // 同一イベントを二重適用し、行動欄を「1,1」にしないよう一意化する。
    const indexes = [...new Set((Array.isArray(window.paramIndexes) ? window.paramIndexes : Object.keys(sources))
      .map(Number)
      .filter((value) => Number.isFinite(value) && sources[value] != null))]
      .sort((a, b) => a - b);
    return { records, sources, indexes };
  }

  function domBattleData() {
    const records = [...document.querySelectorAll('section.round')].map((section) => ({
      num: Number(section.querySelector('.round-count')?.textContent.trim()),
      el: section,
      paramIndexes: [...section.querySelectorAll('div[class^="parameters"]')]
        .map((node) => Number(node.className.match(/parameters(\d+)/)?.[1]))
        .filter(Number.isFinite),
    })).filter(({ num }) => Number.isFinite(num));
    const sources = [];
    for (const node of document.querySelectorAll('div[class^="parameters"]')) {
      const index = Number(node.className.match(/parameters(\d+)/)?.[1]);
      if (Number.isFinite(index)) sources[index] = node.textContent;
    }
    const indexes = Object.keys(sources).map(Number).sort((a, b) => a - b);
    return records.length && indexes.length ? { records, sources, indexes } : null;
  }

  function roundActions(record) {
    let root = record.el;
    if (!root || !root.querySelector('.turn')) {
      if (!record.html) return new Map();
      const template = document.createElement('template');
      template.innerHTML = record.html;
      root = template.content;
    }
    const actions = [];
    for (const actor of root.querySelectorAll('span.actor')) {
      // 追加行動は section.turn に包まれず、actor の直後へ直接追加される。
      // 子孫全体の文面ではなく、ログに表示された「(n行動目)」のテキストだけを読む。
      let actionNumberText = '';
      let sibling = actor.nextSibling;
      while (sibling && sibling.nodeType === Node.TEXT_NODE) {
        actionNumberText += sibling.textContent;
        sibling = sibling.nextSibling;
      }
      const action = sibling?.nodeType === Node.ELEMENT_NODE
        && sibling.matches('section.checkactions[id^="index"]')
        && sibling.querySelector(':scope > section.action')
        ? sibling
        : null;
      const match = action?.id.match(/^index(\d+)and(\d+)$/);
      const actionNumber = Number(actionNumberText.match(/\((\d+)行動目\)/)?.[1]);
      if (!match || !Number.isFinite(actionNumber)) continue;
      const skillElement = action.querySelector(':scope > section.action > .skill-name, :scope > section.action > .skill-name-enemy');
      const skillCopy = skillElement?.cloneNode(true);
      skillCopy?.querySelector('.d-name')?.remove();
      const mutationDepths = {};
      for (const popup of action.querySelectorAll(':scope > .depth-popup-area .text')) {
        const match = popup.textContent.replace(/\s+/g, '').match(/(猛毒|凍結|呪縛|麻痺|治癒|平穏|祝福|加護)深度:(\d+)/);
        if (!match) continue;
        mutationDepths[progressingEffects.get(match[1])] = Number(match[2]);
      }
      actions.push({
        unitId: Number(match[1]),
        parameterIndex: Number(match[2]),
        actionNumber,
        skill: skillCopy?.textContent.replace(/！+$/, '').trim() ?? '',
        mutationDepths,
      });
    }
    return actions;
  }

  function collectTimeline(units) {
    const data = officialBattleData() ?? domBattleData();
    if (!data) return [];
    const initial = window.initialUnitStatus ?? {};
    const state = new Map(units.map((unit) => [unit.id, { ...unit.initial, ...(initial[unit.id] ?? {}) }]));
    const rounds = [];
    let indexCursor = 0;

    for (const record of [...data.records].sort((a, b) => a.num - b.num)) {
      const roundIndexes = [...new Set((record.paramIndexes ?? []).map(Number).filter(Number.isFinite))]
        .sort((a, b) => a - b);
      const startIndex = roundIndexes.length ? roundIndexes[0] : Infinity;
      const endIndex = roundIndexes.length ? roundIndexes[roundIndexes.length - 1] : -1;

      // 戦闘開始時処理など、最初のTURNより前に確定した状態を取り込む。
      while (indexCursor < data.indexes.length && data.indexes[indexCursor] < startIndex) {
        const parameterIndex = data.indexes[indexCursor++];
        try {
          const changes = JSON.parse(data.sources[parameterIndex] || '[]');
          for (const item of changes) {
            if (Number.isFinite(Number(item.i))) state.set(Number(item.i), { ...item });
          }
        } catch {
          // 壊れた1イベントだけを無視し、それ以前の状態を維持する。
        }
      }

      // 新形式では公式が、各TURNのSP計算直後・行動前のスナップショットを持つ。
      // 旧形式では状態は前TURN終了時のものを使い、SPだけをそのTURNで最初に
      // 記録された実測値で補う。平穏・凍結からSPを推定しない。
      const snapshot = new Map([...state].map(([id, value]) => [id, { ...value }]));
      if (record.status) {
        for (const [id, value] of Object.entries(record.status)) snapshot.set(Number(id), { ...value });
      } else {
        const firstObserved = new Map();
        for (const parameterIndex of roundIndexes) {
          try {
            for (const item of JSON.parse(data.sources[parameterIndex] || '[]')) {
              const id = Number(item.i);
              if (Number.isFinite(id) && !firstObserved.has(id)) firstObserved.set(id, item);
            }
          } catch {
            // 解析できないイベントは実測値の候補から外す。
          }
        }
        for (const [id, item] of firstObserved) {
          const value = snapshot.get(id) ?? { i: id };
          snapshot.set(id, { ...value, s: item.s, sb: item.sb });
        }
      }
      if (record.status) {
        state.clear();
        for (const [id, value] of Object.entries(record.status)) state.set(Number(id), { ...value });
      }

      // 次TURNの開始状態を作るため、このTURN内の全イベントを反映する。
      const actions = new Map();
      const actionStartStates = new Map();
      const spCheckStates = new Map();
      const actionsByIndex = new Map();
      for (const action of roundActions(record)) {
        const list = actionsByIndex.get(action.parameterIndex) ?? [];
        list.push(action);
        actionsByIndex.set(action.parameterIndex, list);
      }
      while (indexCursor < data.indexes.length && data.indexes[indexCursor] <= endIndex) {
        const parameterIndex = data.indexes[indexCursor++];
        const firstActions = [];
        for (const action of actionsByIndex.get(parameterIndex) ?? []) {
          if (!actionStartStates.has(action.unitId)) {
            const actionStart = state.get(action.unitId);
            if (actionStart) {
              actionStartStates.set(action.unitId, { ...actionStart });
              const spCheck = { ...actionStart };
              for (const key of progressingEffects.values()) spCheck[key] = 0;
              Object.assign(spCheck, action.mutationDepths);
              spCheckStates.set(action.unitId, spCheck);
              firstActions.push(action);
            }
          }
          const sp = Number(state.get(action.unitId)?.s ?? 0);
          const list = actions.get(action.unitId) ?? [];
          list.push({ ...action, sp, level: spLevel(sp) });
          actions.set(action.unitId, list);
        }
        try {
          const changes = JSON.parse(data.sources[parameterIndex] || '[]');
          for (const item of changes) {
            if (Number.isFinite(Number(item.i))) state.set(Number(item.i), { ...item });
          }
        } catch {
          // 壊れた1イベントだけを無視し、それ以前の状態を維持する。
        }
        // 保護・阻害は行動ごとの時間経過がないため、行動結果保存後の値をBへ反映する。
        for (const action of firstActions) {
          const spCheck = spCheckStates.get(action.unitId);
          const actionEnd = state.get(action.unitId);
          if (!spCheck || !actionEnd) continue;
          spCheck.y = Number(actionEnd.y ?? 0);
          spCheck.so = Number(actionEnd.so ?? 0);
        }
      }
      rounds.push({ turn: record.num, units: snapshot, actions, actionStartStates, spCheckStates });
    }
    return rounds;
  }

  function addCell(row, text = '', className = '', title = '') {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    if (title) cell.title = title;
    row.append(cell);
    return cell;
  }

  function addLabel(row, text, className = '') {
    const cell = document.createElement('th');
    cell.scope = 'row';
    cell.className = `timeline-label ${className}`.trim();
    cell.textContent = text;
    row.append(cell);
    return cell;
  }

  function effectDepth(status, key) {
    const value = Number(status?.[key] ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function isDeparted(status) {
    return !status || Number(status.dw ?? 0) === 1;
  }

  function spLevel(value) {
    return Math.max(0, Math.min(3, Math.floor(Number(value ?? 0) / 100)));
  }

  function uptime(statuses, predicate) {
    const available = statuses
      .map((status, index) => ({ status, index }))
      .filter(({ status }) => !isDeparted(status));
    if (!available.length) return '-';
    const active = available.filter(({ status, index }) => predicate(status, index)).length;
    return `${Math.round((active / available.length) * 100)}%`;
  }

  function appendProtectionPair(cell, protection, obstruction, stacked = false) {
    cell.classList.add('protection-pair');
    if (stacked) cell.classList.add('stacked');
    const protectionValue = document.createElement('span');
    protectionValue.className = `protection-value${protection === 0 || protection === '0%' ? ' zero' : ''}`;
    protectionValue.textContent = String(protection);
    const separator = document.createElement('span');
    separator.className = 'protection-separator';
    separator.textContent = '/';
    const obstructionValue = document.createElement('span');
    obstructionValue.className = `obstruction-value${obstruction === 0 || obstruction === '0%' ? ' zero' : ''}`;
    obstructionValue.textContent = String(obstruction);
    cell.append(protectionValue, separator, obstructionValue);
  }

  function render(panel, units, rounds, unitId) {
    const table = panel.querySelector('.leciar-timeline-table');
    table.replaceChildren();
    const unit = units.find(({ id }) => id === unitId);
    if (!unit) return;

    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'timeline-label';
    corner.textContent = 'TURN';
    headRow.append(corner);
    for (const { turn } of rounds) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = String(turn).padStart(2, '0');
      headRow.append(cell);
    }
    const ratioHead = document.createElement('th');
    ratioHead.scope = 'col';
    ratioHead.className = 'timeline-ratio';
    ratioHead.textContent = '割合';
    headRow.append(ratioHead);
    head.append(headRow);

    const body = document.createElement('tbody');
    const statuses = rounds.map(({ units: states }) => states.get(unitId) ?? {});
    const mutationStatuses = rounds.map(({ spCheckStates }) => spCheckStates.get(unitId) ?? null);
    const spRow = document.createElement('tr');
    addLabel(spRow, 'SP');
    statuses.forEach((status, index) => {
      if (isDeparted(status)) {
        addCell(spRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
        return;
      }
      const sp = Number(status.s ?? 0);
      const level = spLevel(sp);
      addCell(spRow, String(sp), `sp-value slv${level}`, `TURN ${rounds[index].turn} SP計算時：SP ${sp} / SPLv${level}`);
    });
    addCell(spRow, '—', 'timeline-ratio');
    body.append(spRow);

    const deltaRow = document.createElement('tr');
    addLabel(deltaRow, 'SP増減');
    statuses.forEach((status, index) => {
      if (isDeparted(status)) {
        addCell(deltaRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
        return;
      }
      const nextStatus = statuses[index + 1];
      if (!nextStatus || isDeparted(nextStatus)) {
        addCell(deltaRow, '-', 'sp-baseline', `TURN ${rounds[index].turn}：次のTURNのSP計算値がないため比較できません`);
        return;
      }
      const currentSp = Number(status.s ?? 0);
      const nextSp = Number(nextStatus.s ?? currentSp);
      const delta = nextSp - currentSp;
      const text = delta > 0 ? `+${delta}` : String(delta);
      const kind = delta > 10 ? 'sp-above-default' : delta < 10 ? 'sp-below-default' : 'sp-default';
      addCell(deltaRow, text, kind, `TURN ${rounds[index].turn} から次のTURNのSP計算までの実測増減（SP ${currentSp} → ${nextSp}、標準 +10）`);
    });
    addCell(deltaRow, '—', 'timeline-ratio');
    body.append(deltaRow);

    const continuousRow = document.createElement('tr');
    addLabel(continuousRow, '連続値');
    statuses.forEach((status, index) => {
      if (isDeparted(status)) {
        addCell(continuousRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
        return;
      }
      const value = Number(status.sd ?? 0);
      addCell(continuousRow, String(value), `continuous-value${value >= 100 ? ' ready' : ''}`, `TURN ${rounds[index].turn} SP計算時：連続値 ${value}`);
    });
    addCell(continuousRow, '—', 'timeline-ratio');
    body.append(continuousRow);

    const actionRow = document.createElement('tr');
    addLabel(actionRow, '行動');
    statuses.forEach((status, index) => {
      if (isDeparted(status)) {
        addCell(actionRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
        return;
      }
      const actions = rounds[index].actions.get(unitId) ?? [];
      const cell = addCell(actionRow, '', actions.length ? 'action-numbers' : 'sp-flat', actions.length ? '' : `TURN ${rounds[index].turn}：行動なし`);
      if (!actions.length) {
        cell.textContent = '0';
        return;
      }
      cell.title = actions.map(({ actionNumber, level, skill }) => `${actionNumber}行動目：SPLv${level}${skill ? ` / ${skill}` : ''}`).join('\n');
      actions.forEach(({ actionNumber, level }, actionIndex) => {
        if (actionIndex) cell.append(',');
        const number = document.createElement('span');
        number.className = `action-number slv${level}`;
        number.textContent = String(actionNumber);
        cell.append(number);
      });
    });
    addCell(actionRow, '—', 'timeline-ratio');
    body.append(actionRow);

    function addFocusEffectGroup(label, kind, focusKey, focusName, definitions) {
      const summaryRow = document.createElement('tr');
      const labelCell = addLabel(summaryRow, '', `${kind} group-label`);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'timeline-toggle';
      button.textContent = `▶ ${label}`;
      labelCell.append(button);

      mutationStatuses.forEach((status, index) => {
        if (isDeparted(statuses[index])) {
          addCell(summaryRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
          return;
        }
        if (!status) {
          addCell(summaryRow, '-', 'sp-baseline', `TURN ${rounds[index].turn}：通常行動なし`);
          return;
        }
        const focusDepth = effectDepth(status, focusKey);
        const active = definitions.filter(([key]) => effectDepth(status, key) > 0);
        const names = active.map(([, name]) => name);
        const cell = addCell(summaryRow, '', `focus-summary ${kind}`, `TURN ${rounds[index].turn}：${focusName} 深度${focusDepth} / その他${active.length ? ` ${names.join('、')}` : 'なし'}`);
        if (focusDepth) {
          const marker = document.createElement('span');
          marker.className = 'focus-diamond';
          marker.textContent = '◆';
          marker.setAttribute('aria-label', `${focusName}あり`);
          cell.append(marker);
          if (active.length) cell.append(`+${active.length}`);
        } else {
          cell.textContent = String(active.length);
        }
      });

      const focusRatio = uptime(mutationStatuses, (status) => effectDepth(status, focusKey) > 0);
      const otherRatio = uptime(mutationStatuses, (status) => definitions.some(([key]) => effectDepth(status, key) > 0));
      const ratio = addCell(summaryRow, '', `timeline-ratio focus-ratio ${kind}`, `${focusName} ${focusRatio} / その他 ${otherRatio}（離脱後を除外）`);
      const focusLine = document.createElement('span');
      focusLine.className = 'focus-ratio-main';
      focusLine.textContent = `◆ ${focusRatio}`;
      const otherLine = document.createElement('span');
      otherLine.className = 'focus-ratio-other';
      otherLine.textContent = `他 ${otherRatio}`;
      ratio.append(focusLine, otherLine);
      body.append(summaryRow);

      const detailRows = [[focusKey, focusName], ...definitions].map(([key, name], detailIndex) => {
        const row = document.createElement('tr');
        row.className = `effect-detail ${kind}`;
        row.hidden = true;
        addLabel(row, name, `effect-name${detailIndex === 0 ? ' focus-name' : ''}`);
        mutationStatuses.forEach((status, index) => {
          if (isDeparted(statuses[index])) {
            addCell(row, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
            return;
          }
          if (!status) {
            addCell(row, '-', 'sp-baseline', `TURN ${rounds[index].turn}：通常行動なし`);
            return;
          }
          const depth = effectDepth(status, key);
          addCell(row, depth ? String(depth) : '', depth ? 'has-depth' : '', `TURN ${rounds[index].turn}：${name}${depth ? ` 深度${depth}` : 'なし'}`);
        });
        addCell(row, uptime(mutationStatuses, (status) => effectDepth(status, key) > 0), 'timeline-ratio', `${name}がSP増加量判定時に付いていた割合`);
        body.append(row);
        return row;
      });
      button.addEventListener('click', () => {
        const opening = detailRows.some((row) => row.hidden);
        detailRows.forEach((row) => { row.hidden = !opening; });
        button.textContent = `${opening ? '▼' : '▶'} ${label}`;
        button.setAttribute('aria-expanded', String(opening));
      });
    }

    function addEffectGroup(label, kind, definitions, paired = false) {
      const summaryRow = document.createElement('tr');
      const labelCell = addLabel(summaryRow, '', `${kind} group-label`);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'timeline-toggle';
      button.textContent = `▶ ${label}`;
      labelCell.append(button);
      mutationStatuses.forEach((status, index) => {
        if (isDeparted(statuses[index])) {
          addCell(summaryRow, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
          return;
        }
        if (!status) {
          addCell(summaryRow, '-', 'sp-baseline', `TURN ${rounds[index].turn}：通常行動なし`);
          return;
        }
        const active = definitions.filter(([key]) => effectDepth(status, key) > 0);
        if (paired) {
          const protection = effectDepth(status, 'y');
          const obstruction = effectDepth(status, 'so');
          const cell = addCell(summaryRow, '', kind, `TURN ${rounds[index].turn}：保護 深度${protection} / 阻害 深度${obstruction}`);
          appendProtectionPair(cell, protection, obstruction);
        } else {
          addCell(summaryRow, String(active.length), `${kind}-count`, `TURN ${rounds[index].turn}：${active.length ? active.map(([, name]) => name).join('、') : 'なし'}`);
        }
      });
      if (paired) {
        const protectionRatio = uptime(mutationStatuses, (status) => effectDepth(status, 'y') > 0);
        const obstructionRatio = uptime(mutationStatuses, (status) => effectDepth(status, 'so') > 0);
        const ratio = addCell(summaryRow, '', 'timeline-ratio', `保護 ${protectionRatio} / 阻害 ${obstructionRatio}（離脱後を除外）`);
        appendProtectionPair(ratio, protectionRatio, obstructionRatio, true);
      } else {
        addCell(summaryRow, uptime(mutationStatuses, (status) => definitions.some(([key]) => effectDepth(status, key) > 0)), 'timeline-ratio', `${label}がSP増加量判定時に1種類以上付いていた割合`);
      }
      body.append(summaryRow);

      const detailRows = definitions.map(([key, name]) => {
        const row = document.createElement('tr');
        row.className = `effect-detail ${kind}`;
        row.hidden = true;
        addLabel(row, name, 'effect-name');
        mutationStatuses.forEach((status, index) => {
          if (isDeparted(statuses[index])) {
            addCell(row, '-', 'departed', `TURN ${rounds[index].turn}：離脱済み`);
            return;
          }
          if (!status) {
            addCell(row, '-', 'sp-baseline', `TURN ${rounds[index].turn}：通常行動なし`);
            return;
          }
          const depth = effectDepth(status, key);
          addCell(row, depth ? String(depth) : '', depth ? 'has-depth' : '', `TURN ${rounds[index].turn}：${name}${depth ? ` 深度${depth}` : 'なし'}`);
        });
        addCell(row, uptime(mutationStatuses, (status) => effectDepth(status, key) > 0), 'timeline-ratio', `${name}がSP増加量判定時に付いていた割合`);
        body.append(row);
        return row;
      });
      button.addEventListener('click', () => {
        const opening = detailRows.some((row) => row.hidden);
        detailRows.forEach((row) => { row.hidden = !opening; });
        button.textContent = `${opening ? '▼' : '▶'} ${label}`;
        button.setAttribute('aria-expanded', String(opening));
      });
    }

    addFocusEffectGroup('平穏+良性', 'peace', 'pe', '平穏', goodEffects);
    addFocusEffectGroup('凍結+悪性', 'freeze', 'f', '凍結', badEffects);
    addEffectGroup('保護/阻害', 'protection', protectionEffects, true);
    table.append(head, body);
    panel.querySelector('.timeline-current-unit').textContent = `${unit.side}：${unit.name}`;
  }

  function installStyle() {
    if (document.getElementById('leciar-sp-mutation-timeline-style')) return;
    const style = document.createElement('style');
    style.id = 'leciar-sp-mutation-timeline-style';
    style.textContent = `
      .leciar-sp-mutation-timeline { margin: 14px 0; padding: 10px 12px; border: 1px solid rgba(255,255,255,.22); border-radius: 8px; }
      .leciar-sp-mutation-timeline > summary { cursor: pointer; font-weight: 700; }
      .leciar-timeline-controls { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 10px 0 8px; }
      .leciar-timeline-controls select { max-width: 100%; padding: 3px 6px; }
      .timeline-current-unit { color: rgba(255,255,255,.72); font-size: .85em; }
      .leciar-timeline-scroll { overflow-x: auto; padding-bottom: 5px; }
      .leciar-timeline-table { border-collapse: separate; border-spacing: 0; min-width: max-content; font-size: .82em; text-align: center; }
      .leciar-timeline-table th, .leciar-timeline-table td { box-sizing: border-box; min-width: 34px; height: 28px; padding: 3px 4px; border-right: 1px solid rgba(255,255,255,.1); border-bottom: 1px solid rgba(255,255,255,.1); }
      .leciar-timeline-table thead th { position: sticky; top: 0; z-index: 2; background: #303030; }
      .leciar-timeline-table .timeline-label { position: sticky; left: 0; z-index: 1; min-width: 112px; text-align: left; white-space: nowrap; background: #282828; }
      .leciar-timeline-table thead .timeline-label { z-index: 3; }
      .leciar-timeline-table .timeline-ratio { position: sticky; right: 0; z-index: 1; min-width: 52px; font-weight: 700; background: #282828; }
      .leciar-timeline-table thead .timeline-ratio { z-index: 3; background: #303030; }
      .leciar-timeline-table .sp-value { font-weight: 700; }
      .leciar-timeline-table .sp-value.slv1 { color: #75d7ff; }
      .leciar-timeline-table .sp-value.slv2 { color: #ffd36f; }
      .leciar-timeline-table .sp-value.slv3 { color: #ff8fd7; }
      .leciar-timeline-table .sp-above-default { color: #a9edc1; font-weight: 700; }
      .leciar-timeline-table .sp-below-default { color: #d3b2ff; font-weight: 700; }
      .leciar-timeline-table .sp-default { color: inherit; }
      .leciar-timeline-table .sp-baseline { opacity: .55; }
      .leciar-timeline-table .sp-flat { opacity: .55; }
      .leciar-timeline-table .continuous-value.ready { color: #ffbf84; font-weight: 700; }
      .leciar-timeline-table .action-numbers { min-width: 40px; padding-left: 2px; padding-right: 2px; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
      .action-number.slv0 { color: inherit; }
      .action-number.slv1 { color: #75d7ff; }
      .action-number.slv2 { color: #ffd36f; }
      .action-number.slv3 { color: #ff8fd7; }
      .focus-summary { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .focus-summary .focus-diamond { margin-right: 1px; }
      .focus-summary.peace .focus-diamond, .focus-ratio.peace .focus-ratio-main, .effect-detail.peace .focus-name, .effect-detail.peace .has-depth { color: #70d696; }
      .focus-summary.freeze .focus-diamond, .focus-ratio.freeze .focus-ratio-main, .effect-detail.freeze .focus-name, .effect-detail.freeze .has-depth { color: #9e96ff; }
      .focus-ratio .focus-ratio-main, .focus-ratio .focus-ratio-other { display: block; line-height: 1.15; white-space: nowrap; }
      .focus-ratio .focus-ratio-other { font-weight: 400; opacity: .82; }
      .timeline-toggle { border: 0; padding: 0; color: inherit; background: transparent; font: inherit; cursor: pointer; }
      .good-count, .effect-detail.good .has-depth { color: #a9edc1; }
      .bad-count, .effect-detail.bad .has-depth { color: #ffaaa8; }
      .protection-count, .effect-detail.protection .has-depth { color: #a8d8ff; }
      .leciar-timeline-table td.protection-pair { min-width: 40px; padding-left: 2px; padding-right: 2px; white-space: nowrap; font-size: .9em; font-variant-numeric: tabular-nums; }
      .protection-pair .protection-value { color: #8fc9ff; }
      .protection-pair .obstruction-value { color: #ffe17a; }
      .protection-pair .protection-separator { margin: 0 1px; color: rgba(255,255,255,.42); }
      .protection-pair .zero { opacity: .42; }
      .protection-pair.stacked .protection-value, .protection-pair.stacked .obstruction-value { display: block; line-height: 1.15; }
      .protection-pair.stacked .protection-separator { display: none; }
      .effect-detail .timeline-label { padding-left: 18px; font-weight: 400; }
      .leciar-timeline-table .departed { color: rgba(255,255,255,.38); }
      .leciar-splv-legend { margin-left: auto; font-size: .78em; white-space: nowrap; }
      .leciar-splv-legend .slv1 { color: #75d7ff; }
      .leciar-splv-legend .slv2 { color: #ffd36f; }
      .leciar-splv-legend .slv3 { color: #ff8fd7; }
      .leciar-timeline-note { margin: 7px 0 0; color: rgba(255,255,255,.68); font-size: .8em; }
      @media (prefers-color-scheme: light) {
        .leciar-timeline-table thead th { background: #ededed; }
        .leciar-timeline-table .timeline-label { background: #f5f5f5; }
        .leciar-timeline-table .timeline-ratio { background: #f5f5f5; }
        .leciar-timeline-table thead .timeline-ratio { background: #ededed; }
        .timeline-current-unit, .leciar-timeline-note { color: rgba(0,0,0,.68); }
      }
    `;
    document.head.append(style);
  }

  function apply() {
    if (document.getElementById('leciar-sp-mutation-timeline') || !document.querySelector('.battle-summary')) return;
    const units = unitInfo();
    const rounds = collectTimeline(units);
    if (!units.length || !rounds.length) return;
    installStyle();

    const panel = document.createElement('details');
    panel.id = 'leciar-sp-mutation-timeline';
    panel.className = 'leciar-sp-mutation-timeline';
    panel.open = true;
    const summary = document.createElement('summary');
    summary.textContent = 'SP・変調推移（Beta）';
    const controls = document.createElement('div');
    controls.className = 'leciar-timeline-controls';
    const label = document.createElement('label');
    label.textContent = '対象：';
    const select = document.createElement('select');
    for (const side of ['味方', '敵']) {
      const groupUnits = units.filter((unit) => unit.side === side);
      if (!groupUnits.length) continue;
      const group = document.createElement('optgroup');
      group.label = side;
      for (const unit of groupUnits) {
        const option = document.createElement('option');
        option.value = String(unit.id);
        option.textContent = unit.name;
        group.append(option);
      }
      select.append(group);
    }
    label.append(select);
    const current = document.createElement('span');
    current.className = 'timeline-current-unit';
    const levelLegend = document.createElement('span');
    levelLegend.className = 'leciar-splv-legend';
    levelLegend.innerHTML = '<span class="slv1">SPLv1</span> / <span class="slv2">SPLv2</span> / <span class="slv3">SPLv3</span>';
    controls.append(label, current, levelLegend);
    const scroll = document.createElement('div');
    scroll.className = 'leciar-timeline-scroll';
    const table = document.createElement('table');
    table.className = 'leciar-timeline-table';
    scroll.append(table);
    const note = document.createElement('p');
    note.className = 'leciar-timeline-note';
    note.textContent = 'SPと連続値は各TURNのSP計算時点、変調は通常行動のスキル効果適用後・経過処理前（SP増加量の判定状態）を表示します。行動欄は通算行動番号をアクション直前のSPLvで色分けします。通常行動がなかったTURNの変調は推測せず「-」にします。';
    panel.append(summary, controls, scroll, note);
    document.querySelector('.battle-summary').insertAdjacentElement('afterend', panel);

    const initialUnit = units.find((unit) => unit.side === '味方') ?? units[0];
    select.value = String(initialUnit.id);
    select.addEventListener('change', () => render(panel, units, rounds, Number(select.value)));
    render(panel, units, rounds, initialUnit.id);
  }

  apply();
})();
