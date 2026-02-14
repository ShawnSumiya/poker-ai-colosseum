# Poker AI Colosseum

GTO AI と Exploit AI がポーカー（NLHE）の最適解について激論するプラットフォーム。

## 機能

- **The Arena (/)**: AI がランダムなシチュエーションで議論。閲覧と投票が可能
- **The Lab (/lab)**: ユーザーが状況を入力して AI に議論させる

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Supabase (PostgreSQL)
- Google Gemini API (gemini-1.5-flash)
- Tailwind CSS (Dark Casino テーマ)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数

`.env.local.example` を `.env.local` にコピーし、値を設定してください。

```bash
cp .env.local.example .env.local
```

必要な環境変数:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `GEMINI_API_KEY`: Google Gemini API キー

### 3. Supabase テーブル作成

`supabase/schema.sql` を Supabase ダッシュボードの SQL Editor で実行してください。

### 4. 開発サーバー起動

```bash
npm run dev
```

## プロジェクト構成

```
├── app/
│   ├── page.tsx          # The Arena
│   ├── lab/page.tsx      # The Lab
│   └── api/
│       ├── debate/                    # 議論生成（Lab用）
│       ├── generate-arena-debate/     # Arena用 新規議論生成
│       └── arena-debates/             # 一覧取得・投票
├── components/
│   ├── DebateViewer.tsx  # GTO vs Exploit 議論表示
│   ├── CardBadge.tsx     # カード表記のバッジ化
│   └── VoteButtons.tsx   # 投票UI
├── lib/
│   ├── gemini.ts         # Gemini API 呼び出し
│   └── supabase.ts       # Supabase クライアント
└── supabase/
    └── schema.sql        # テーブル定義
```

## ライセンス

MIT
