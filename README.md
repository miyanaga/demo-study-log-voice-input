# 勉強時間ログ音声入力デモ

ChatGTPを使って、構造化されたデータを音声入力するデモです。



一連の処理が期待通り動くことを、雑に確認するだけのプログラムです。

主要な処理は`src/views/Main.vue`にあります。

## 解説記事

こちらに解説があります。

https://qiita.com/miyanaga/items/5538aabc5ac23782a97f

## 動作方法

`.env.example`を`.env`にコピーして、Open AIのAPI契約から`VITE_OPENAI_ORG`と`VITE_OPENAI_API_KEY`を指定してください。

```bash
yarn
yarn dev
```

音声入力にはSSLが必須のようなので、`ngrok`でも使ってください。

```bash
ngrok http 5173
```