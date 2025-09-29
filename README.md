# 限定じゃんけん (Limited Janken)

Next.js + TypeScript + Tailwind CSS + Supabase を使った「限定じゃんけん」プラットフォームの M1 実装です。最大 30 人の自由マッチングと実況モニタを前提に、ゲーム開始〜1 試合分のフロー、資産管理、イベントログを組み込んでいます。

## 構成

- **Next.js (Pages Router)**: `/monitor` と `/player` を提供
- **Tailwind CSS / Framer Motion**: ゲーム感のある UI とアニメーション
- **Supabase**: 認証・データ永続化・Edge Functions を利用
- **Edge Functions**: サーバ権威の RPC レイヤーとして 11 関数を用意
- **Shared Game Logic**: `shared/game/engine.ts` に勝敗判定とカード管理

## セットアップ

1. 依存関係をインストールします。

   ```bash
   npm install
   ```

   > **Note**: 本リポジトリでは `npm install --package-lock-only` 相当の `package-lock.json` を同梱しています。

2. 必要な環境変数を `.env.local` に設定します。

   ```env
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_URL=<same-url-for-edge-functions>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

3. Supabase スキーマを適用します。

   ```bash
   supabase db push --file supabase_sql/schema.sql
   ```

4. 開発サーバを起動します。

   ```bash
   npm run dev
   ```

## Edge Functions

Edge Functions は `supabase functions deploy <name>` でデプロイできます。

| ファイル | Supabase RPC | 概要 |
| --- | --- | --- |
| `start_game.ts` | `fn_start_game` | ルーム開始、ローン配布、イベント記録 |
| `propose_match.ts` | `fn_propose_match` | 対戦リクエスト作成 |
| `accept_match.ts` | `fn_accept_match` | マッチ承諾、ロック |
| `move_check.ts` | `fn_move_check` | 手札状況確認 |
| `move_set.ts` | `fn_move_set` | 手札セット・カード消費 |
| `move_open.ts` | `fn_move_open` | 手札公開 |
| `resolve_match.ts` | `fn_resolve_match` | 勝敗確定・星移動 |
| `create_trade_offer.ts` | `fn_create_trade_offer` | トレード予約 (M2 で本実装予定) |
| `accept_trade_offer.ts` | `fn_accept_trade_offer` | トレード承諾 (M2) |
| `settle_trade.ts` | `fn_settle_trade` | トレード決済 (M2) |
| `cancel_trade.ts` | `fn_cancel_trade` | トレード取消 (M2) |
| `evaluate_defeats.ts` | `fn_evaluate_defeats` | 敗北評価 (M2) |

`edge-functions/_shared.ts` が共通ハンドラを提供し、Zod で入力を検証して Supabase RPC を実行します。

## テスト

`jest` + `ts-jest` を使用して共有ロジックと Edge Function をカバーしています。

```bash
npm test
```

- `tests/gameEngine.test.ts`: R/P/S の勝敗とカード消費の単体テスト
- `tests/startGameEdge.test.ts`: Edge Function が正しい RPC を呼び出すことを検証

## GitHub Actions

`.github/workflows/ci.yml` で `lint → test → build` の順に実行されます。CI 環境では `npm ci` を利用します。

## デプロイ

- **Vercel**: `NEXT_PUBLIC_*` 環境変数を設定してデプロイ
- **Supabase**: Edge Functions を `supabase functions deploy` で公開、RLS のためにサービスロールキーを Vercel の `SUPABASE_SERVICE_ROLE_KEY` として登録してください

## 今後の M2 以降

- トレード/敗北評価の本実装
- Realtime チャネルの最適化、監視 UI の自動更新強化
- デバイス別レイアウト調整、アクセシビリティ改善
