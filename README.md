## About This App
個人開発のベトナム語学習アプリです。
OS設定からベトナム語キーボード、ベトナム語言語パックをインストールしてお使いください。

## 特徴
- 完全オフライン動作、無料、無広告で学習意欲を妨げません。
- 同一の単語を繰り返し練習でき、記憶定着を助けます。
- 音声再生機能で聞き分け練習ができます。
- 単語は自分で登録していくスタイルですが、デフォルトで700語程度入っています。
- 単語マスタはCSVファイルで一括インポートでき、重複登録されないようになっています。

## 開発者について
- 自分の学習のために作っただけなので、何か情報を収集するとかそんな面倒なことはしません。
- AI生成をふんだんに使ったので正確性は保障できません。
- 個人開発なのでアップデートは気が向いたらやる程度です。
- マメな性格ではないので連絡頂いてもたぶん返せません。ゴメン。

## MIT License
Copyright © 2026 Yuuki Sakano (@yukisku) All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 開発環境構成メモ (v2.0.1)
この構成を変更すると SQLite の初期化等で不整合が発生する可能性があるため、アップデート時は注意してください。

- **Gradle バージョン**: 9.7.1
- **Android Gradle Plugin (AGP) バージョン**: 9.4.0
- **JDK/JRE バージョン**: Java 21
- **対応 API レベル**: 37 (Android 17)

### Capacitor プラグイン バージョン一覧
- **@capacitor/core**: ^8.0.0
- **@capacitor-community/sqlite**: ^8.1.1
- **@capacitor-community/text-to-speech**: ^8.0.2
- **capacitor-native-settings**: ^8.0.0
- **@capacitor/filesystem**: ^8.0.0
- **@capacitor/preferences**: ^8.0.0
- **@capacitor/share**: ^8.0.0
- **@tanstack/react-query**: ^5.102.8
- **react-intersection-observer**: ^11.0.1
