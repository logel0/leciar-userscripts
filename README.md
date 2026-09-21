# Leciel Arcadia Userscripts

Leciel Arcadiaを使いやすくする、ユーザースクリプトマネージャー向けの非公式ツール集です。

本ツールはLeciel Arcadiaのサイト運営者とは無関係です。サイトの更新により、予告なく動作しなくなる可能性があります。

## スクリプト

### 戦闘詳細・変調内訳

戦闘詳細の与バフ・与デバフを、変調・能力増減などの効果種別ごとに表示します。

- 平穏・凍結・治癒・猛毒が実際に発生させた効果量を対象別に集計
- 保護・阻害が効果を無効化した回数を対象別に集計（セルのツールチップに効果別内訳）
- キャラクターアイコン付近の状態を、良性・悪性・能力変化の3色に分類

- ファイル: `leciar-battle-mutation-breakdown.user.js`
- 対象: Leciel Arcadiaの戦闘結果ページ

### スキルからキャラクター検索

スキル一覧のスキル名を、そのスキルを所持するキャラクターの検索リンクにします。

- ファイル: `leciar-skill-search.user.js`
- 対象: Leciel Arcadiaのスキル一覧

## インストール

1. ブラウザへ[Violentmonkey](https://violentmonkey.github.io/)などのユーザースクリプトマネージャーをインストールします。
2. [配布ページ](https://logel0.github.io/leciar-userscripts/)を開きます。
3. 使用するスクリプトの「インストール」を選択し、Violentmonkeyの確認画面で内容と権限を確認します。

公開前のローカル確認では、各 `.user.js` ファイルをViolentmonkeyの管理画面へドラッグしてインストールできます。

Violentmonkey、Tampermonkey、ScriptCatで利用できる構成です。Greasemonkeyでは`document-idle`の扱いが異なるため参考対応とします。

## 権限と通信

- すべてのスクリプトは `@grant none` です。
- 外部ライブラリを読み込む `@require` は使用していません。
- 独自の外部APIへの送信や、認証情報の保存は行いません。
- 動作対象は `https://rarirupj.com/leciar/` 以下です。

インストール前にソースコードとメタデータを確認してください。

## 更新

更新時は各スクリプトの `@version` を上げ、変更内容をRelease notesまたはコミットへ記録します。各スクリプトの `@downloadURL` はGitHub Pages上の恒久的なHTTPS URLを指定しています。

## 不具合報告

[GitHub Issues](https://github.com/logel0/leciar-userscripts/issues)に、対象ページ、発生した現象、期待する結果、スクリプトのバージョンを記載してください。公開してよい情報だけを添付し、Cookie、認証情報、非公開ログ、第三者の個人情報は投稿しないでください。

## 利用上の注意

- [Leciel Arcadia利用規約](https://rarirupj.com/leciar/rulebook/terms)を守って利用してください。
- サーバーへ大きな負担をかける利用、意図的なバグ利用、不具合の悪用には使用しないでください。
- 本スクリプトは表示中のページを補助するもので、自動巡回や大量アクセスを行う機能はありません。
- ゲーム内コンテンツ、プロフィール、キャラクター画像などの権利は、それぞれの運営者または権利者に帰属します。

## ライセンス

作者は `logel0` です。2本のユーザースクリプトは[MIT License](LICENSE)で提供し、利用、改変、再配布を認めます。

このライセンスはLeciel Arcadia本体、サイト上の文章、保存した戦闘ログ、キャラクター画像などの第三者素材には適用されません。

本ソフトウェアは無保証です。利用によって生じた損害について、作者およびコントリビューターは責任を負いません。
