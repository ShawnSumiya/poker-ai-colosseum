import { createClient } from '@/utils/supabase/server';

export default async function GlobalFactionBar() {
  const supabase = createClient();
  
  // 全投票数を集計（これが増えると重くなるので、将来はRPCかキャッシュ推奨）
  // 今は単純に全件取得して計算します
  const { data: allDebates } = await supabase
    .from("arena_debates")
    .select("votes_gto, votes_exploit");

  let totalGto = 0;
  let totalExploit = 0;

  if (allDebates) {
    allDebates.forEach(d => {
      totalGto += d.votes_gto || 0;
      totalExploit += d.votes_exploit || 0;
    });
  }

  const grandTotal = totalGto + totalExploit || 1;
  const gtoPercent = Math.round((totalGto / grandTotal) * 100);
  const exploitPercent = 100 - gtoPercent;

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 py-2 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between text-xs font-mono mb-1 text-slate-400 uppercase tracking-wider">
          <span className={gtoPercent > 50 ? "text-blue-400 font-bold" : ""}>
            GTO Dominance: {gtoPercent}%
          </span>
          <span className="text-slate-600">Total Battles: {allDebates?.length || 0}</span>
          <span className={exploitPercent > 50 ? "text-red-400 font-bold" : ""}>
            Exploit Resistance: {exploitPercent}%
          </span>
        </div>
        
        {/* ゲージ本体 */}
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
            style={{ width: `${gtoPercent}%` }}
          />
          <div 
            className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-1000"
            style={{ width: `${exploitPercent}%` }}
          />
        </div>

        {/* フレーバーテキスト（優勢な方のメッセージ） */}
        <div className="text-center mt-1 text-[10px] text-slate-500 font-mono">
          {gtoPercent > 60 && "⚠️ The world is controlled by solvers."}
          {exploitPercent > 60 && "⚠️ Chaos is spreading. GTO is dying."}
          {Math.abs(gtoPercent - exploitPercent) <= 20 && "⚖️ The world is in balance."}
        </div>
      </div>
    </div>
  );
}
