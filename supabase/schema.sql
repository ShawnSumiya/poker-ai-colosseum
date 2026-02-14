-- 1. Arena (トップページ用) のテーブル作成
create table public.arena_debates (
  id uuid not null default gen_random_uuid() primary key,
  title text not null,
  scenario_json jsonb not null, -- ポジション、スタック、ボード等の状況
  transcript_json jsonb not null, -- AI同士の会話ログ
  votes_gto integer not null default 0,
  votes_exploit integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Lab (解析ページ用) のテーブル作成
create table public.lab_analyses (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid, -- 将来的な認証用 (現在はNULL許容)
  input_scenario jsonb not null, -- ユーザーが入力した設定
  transcript_json jsonb not null, -- 生成された会話
  created_at timestamptz not null default now()
);

-- 3. Row Level Security (RLS) の有効化
-- これにより、許可された操作以外をブロックします
alter table public.arena_debates enable row level security;
alter table public.lab_analyses enable row level security;

-- 4. アクセスポリシーの作成

-- Arena: 誰でも閲覧可能 (SELECT)
create policy "Public debates are viewable by everyone"
  on public.arena_debates for select
  using (true);

-- Arena: API経由で新規議論を追加可能
create policy "Service can insert arena debates"
  on public.arena_debates for insert
  with check (true);

-- Arena: increment_vote RPC 経由で投票を許可 (anon から RPC を呼ぶ場合に必要)
create policy "Anyone can vote on arena debates"
  on public.arena_debates for update
  using (true);

-- Lab: 誰でも閲覧可能 (SELECT) - 共有機能のため
create policy "Lab analyses are viewable by everyone"
  on public.lab_analyses for select
  using (true);

-- Lab: 誰でも作成可能 (INSERT) - ユーザーからの投稿を受け付けるため
create policy "Anyone can create a lab analysis"
  on public.lab_analyses for insert
  with check (true);

-- ※ ArenaのINSERT/UPDATEは、サーバーサイド(API)からService Roleキーを使って行う想定のため、
--   ここでのAnonキー向けポリシーは不要ですが、念のため開発用に許可する場合は以下を追加してください。
-- create policy "Service role updates arena" on public.arena_debates using (true);


-- 5. 投票機能用の関数 (RPC)
-- クライアントから直接 update させず、この関数を呼ぶことで「投票数の競合」を防ぎます。
-- 使い方: await supabase.rpc('increment_vote', { row_id: '...', vote_side: 'gto' })

create or replace function increment_vote(row_id uuid, vote_side text)
returns void as $$
begin
  if vote_side = 'gto' then
    update public.arena_debates
    set votes_gto = votes_gto + 1
    where id = row_id;
  elsif vote_side = 'exploit' then
    update public.arena_debates
    set votes_exploit = votes_exploit + 1
    where id = row_id;
  else
    raise exception 'Invalid vote side';
  end if;
end;
$$ language plpgsql;
