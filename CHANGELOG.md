# Changelog

このファイルには、利用者へ影響する変更を記録します。

## Unreleased

- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.7: TURN境界で重複する公式パラメータ索引を一意化し、同じ行動番号・スキルが行動欄へ二重表示される問題を修正。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.6: 行動番号を各 `actor` 直後の「(n行動目)」から取得し、`section.turn` の外側に出力される追加行動も行動欄へ表示。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.5: 表の変調を通常行動直前Aから、スキル効果適用後・経過処理前のSP増加量判定状態Bへ変更。ログの経過処理前深度を直接取得。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.4: 変調の参照時点をTURN開始時から各キャラクターの通常行動開始直前へ変更。TURN途中で付与された変調をSP増減と対応させ、通常行動がないTURNは `-` を表示。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.3: SP増減を1列左へ移し、各TURNから次のTURNのSP計算までに増えた値として表示。最終TURNなど比較先がない列は `-`。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.2: SP増減のTURN 1を比較対象外の `-` に変更。標準の `+10` 未満を紫、超過を緑で強調。
- `leciar-sp-mutation-timeline.user.js` v0.2.0-beta.1: SP計算時点の連続値と、各TURNで実行した通算行動番号を追加。各番号はアクション直前のSPLvで色分けし、通常行動後にSPが増える連続行動にも対応。
- `leciar-sp-mutation-timeline.user.js` v0.1.0-beta.4: 平穏とその他良性、凍結とその他悪性をそれぞれ1行へ統合。平穏・凍結の有無を色付き `◆`、その他を種類数で表示し、展開後に各深度を表示。
- `leciar-sp-mutation-timeline.user.js` v0.1.0-beta.3: 保護・阻害サマリを青い保護深度と黄色い阻害深度の `保護/阻害` 表示へ変更。割合も右端に2段表示。
- `leciar-sp-mutation-timeline.user.js` v0.1.0-beta.2: SPへ影響しない保護・阻害を専用の折り畳みへ分離し、各変調行の右端に生存TURN中の付与割合を追加。
- `leciar-sp-mutation-timeline.user.js` v0.1.0-beta.1を追加。キャラクター別に、各ターンのSP計算時点におけるSP実測値、平穏・凍結、その他良性・悪性変調の種類数と深度を表示。SPLv到達色と離脱後表示にも対応。
- v1.8.4-beta.3: 状態アイコンの色分け凡例を戦闘開始位置からページ末尾へ移動。
- v1.8.4-beta.2: 状態アイコンの攻減・守減・速減を、戦闘詳細の減少系表示に合わせた紫へ変更。凡例も能力増加と能力減少に分離。
- v1.8.4-beta.1: 公式の元スキル名表示に対応し、スクリプト独自の元スキル名追加表示を終了。スキル詳細の一覧では `summary` の元スキル名だけを集計キーとして取得。
- 「キャラクターの戦闘結果一覧」は公式機能の実装に伴い公開終了。
- v1.8.3-beta.3: 仮想スクロールで再生成される状態アイコンへ、属性セレクターのCSSで常時着色。
- v1.8.3-beta.2: スクロール時のDOM差し替えを監視し、背景色を失った状態アイコンだけ再着色。
- v1.8.3: 状態アイコンの背景色を不透明色へ戻し、表示されない環境へ対応。
- v1.8.2: 状態アイコンの枠線を廃止し、半透明の背景色だけを設定。
- v1.8.1: 状態色を親要素ではなく `img.status-icon` のインライン背景色へ直接設定。
- 戦闘詳細で、保護・阻害が変調を防いだ回数と効果別内訳を表示。
- 戦闘中の状態アイコンを、良性・悪性・能力変化で色分け。
- 作者表記をGitHub Ownerの `logel0` に統一。
- GitHub Pagesの配布URL、リポジトリ、Issueへのリンクを追加。
- Leciel Arcadia利用規約へのリンクと利用上の注意を追加。

## 現在のバージョン

- `leciar-battle-mutation-breakdown.user.js`: 1.8.4-beta.3
- `leciar-sp-mutation-timeline.user.js`: 0.2.0-beta.7
- `leciar-skill-search.user.js`: 1.0.3

## 公開終了

- `leciar-profile-battle-logs.user.js`: 1.0.3（公式機能の実装に伴い公開終了）
