# 正誤判定ロジックのリファクタリングとモード名の変更

`db.js` に正誤判定ロジックを統合し、"BIGINNERモード"（単語練習）において完全一致での判定を可能にします。また、将来的な「文章練習」の追加を見据えた拡張性を持たせます。

## Proposed Changes

### [db.js](file:///C:/Users/yukis/StudioProjects/hocviet/src/db.js)
#### [MODIFY] [db.js](file:///C:/Users/yukis/StudioProjects/hocviet/src/db.js)
- `stripToneMarks` および `normalizeText` 関数を追加し、ロジックを共通化します。
- `checkAnswer(input, target, mode)` メソッドを追加し、コントローラー層での判定ロジックを集約します。
- `mode === 'word'` (旧 beginner) では完全一致をデフォルトとし、オプションで声調無視を選択できるように設計します。

### [PracticeMode.jsx](file:///C:/Users/yukis/StudioProjects/hocviet/src/components/PracticeMode.jsx)
#### [MODIFY] [PracticeMode.jsx](file:///C:/Users/yukis/StudioProjects/hocviet/src/components/PracticeMode.jsx)
- 内部の `stripToneMarks` と `normalize` を削除し、`db.js` の関数を使用するように変更します。
- UI上のラベルを "Beginner" から "単語練習" に変更します。
- `mode` の値を `beginner` から `word` に変更します。

### [App.jsx](file:///C:/Users/yukis/StudioProjects/hocviet/src/App.jsx)
#### [MODIFY] [App.jsx](file:///C:/Users/yukis/StudioProjects/hocviet/src/App.jsx)
- `PracticeMode` に渡す `mode` プロパティを `word` に変更します。

## Verification Plan
1. 単語練習モードで、声調記号を含めて正確に入力した場合に「正解」となることを確認。
2. 声調記号を抜いて入力した場合に、期待通りの判定（今回は完全一致を希望されているため「不正解」）になることを確認。
3. 将来的な「文章練習」モードの追加が容易な構造になっていることをコードレベルで確認。
