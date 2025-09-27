# Limited Janken

限定じゃんけんを Next.js + Supabase で構築するためのMVPスキャフォールドです。モニター用ダッシュボードとプレイヤー用スマホUI、勝敗判定ユーティリティ、Edge Functions(RPC)、Supabase スキーマなどを含みます。

## スタック

- Next.js 14 (Pages Router, TypeScript)
- Tailwind CSS + Framer Motion
- Supabase (PostgreSQL, Realtime, Edge Functions, RLS)
- Jest + React Testing Library
- GitHub Actions / Vercel デプロイ

## セットアップ

```bash
npm install
```

### 必要な環境変数

ローカル開発および Vercel で以下を設定します。

| 変数 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions で使用する service role キー |

Edge Functions には `SUPABASE_URL` も必要です (Supabase CLI の `.env` で自動設定されます)。

### ローカル開発

1. Supabase CLI をインストールし、`supabase start` でローカル環境を起動します。
2. `supabase_sql` に含まれる `schema.sql` を適用します。
3. `npm run dev` で Next.js を起動します。
4. ブラウザで `http://localhost:3000` にアクセスし、`/monitor` と `/player` を確認します。

### テスト

```bash
npm run test
```

`shared/game/engine.ts` の勝敗ロジックに対するユニットテストを含みます。

### Lint / Build

```bash
npm run lint
npm run build
```

## Supabase スキーマと RLS

`supabase_sql/schema.sql` には以下の主要テーブルが定義されています：

- `rooms`, `players`, `player_assets`
- `matches`, `match_moves`, `used_card_logs`
- `trade_offers`, `star_transfers`, `penalties`, `events`

プレイヤーは自身の `player_assets` のみ選択・更新できるよう RLS を設定しています。`matches` や `events` もルーム単位のアクセス制限を行っています。

## Edge Functions (RPC)

`edge-functions` ディレクトリに Supabase Edge Functions を配置しています。各関数は zod で入力検証を行い、`supabase.functions.invoke` 経由で呼び出します。

- `start_game` — ルームを稼働状態にし、資産を初期化します。
- `propose_match`, `accept_match` — 挑戦の管理。
- `move_check`, `move_set`, `move_open`, `resolve_match` — 試合の進行と勝敗判定。
- `create_trade_offer`, `accept_trade_offer`, `settle_trade`, `cancel_trade` — トレードのライフサイクル。
- `evaluate_defeats` — 星欠損やローン未返済プレイヤーの検知。

※ 現状はシンプルな実装であり、将来的に PostgreSQL RPC でのトランザクション化や悲観ロックの強化が必要です。

## フロントエンド

- `/monitor` — ゲーム開始 UI、スコアボード、残り時間カウントダウン、実況ログを表示します。Supabase Realtime で `events` テーブルを購読します。
- `/player` — 挑戦 / 受諾、じゃんけんの各フェーズ、資産状況、トレード UI を提供します。スマホ操作を想定したタッチフレンドリーなボタンとアニメーション付きです。

## デプロイ

- Vercel で Next.js をデプロイし、環境変数を登録します。
- Supabase CLI で Edge Functions をデプロイします。例：`supabase functions deploy start_game`。
- GitHub Actions (`.github/workflows/ci.yml`) が lint/test/build を自動実行します。

## 今後のステップ

- Edge Functions のトランザクション化 (`select ... for update`) とリトライ制御
- トレード UI の改善、敗北判定ロジックの詳細化
- 本番運用に向けた監視・ログの整備
