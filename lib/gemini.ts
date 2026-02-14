import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || ""; 
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", 
  generationConfig: {
    responseMimeType: "application/json"
  }
});

export type PokerScenario = {
  gameType: "Cash" | "MTT";
  players: number;
  stackDepth: number;     // 有効スタック
  potSize: number;        // フロップ時点のポットサイズ（これでSPRが決まる）
  potType: string;        // SRP, 3-bet, 4-bet
  heroHand?: string;
  board?: string;
  heroPosition?: string;
  villainPosition?: string;
  context?: string;
  durationMode?: "Short" | "Medium" | "Long"; // 議論の激しさ（未指定時は Medium）
};

export type DebateContext = {
  gtoPercentage?: number;
  exploitPercentage?: number;
};

function cleanJsonString(text: string): string {
  let clean = text.replace(/```json/g, "").replace(/```/g, "");
  clean = clean.trim();
  return clean;
}

// ランダムな整数を生成する便利関数
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ★ ハンドレンジの定義（GTOでよく使われるハンドを重み付けする）
const HAND_RANGES = {
  // プレミアム (AA, KK, AKsなど): 4bet Potなどでよく出る
  premium: [
    "AA", "KK", "QQ", "JJ", "TT",
    "AKs", "AQs", "AJs", "KQs",
    "AKo", "AQo"
  ],
  // プレイアブル (ポケットペア, スーテッド, ブロードウェイ): 通常のレイズ/コールでよく出る
  playable: [
    "99", "88", "77", "66", "55", "44", "33", "22",
    "ATs", "KJs", "KTs", "QJs", "QTs", "JTs",
    "AJo", "KQo", "KJo", "QJo"
  ],
  // スペキュレイティブ (スーテッドコネクタ, Axs): 参加頻度は低いがプレイされる
  speculative: [
    "T9s", "98s", "87s", "76s", "65s", "54s",
    "A9s", "A8s", "A7s", "A5s", "A4s", "A3s", "A2s",
    "K9s", "Q9s", "J9s"
  ],
  // トラッシュ (完全ランダム): ブラフや事故を再現するために少し混ぜる
  trash: [] as string[] // 関数内で生成
};

// ★ リアルなハンドを生成する関数（GTOレンジ対応版）
function getRealisticHand(): string {
  const rand = Math.random();

  // 1. 30% の確率で「プレミアムハンド」
  if (rand < 0.30) {
    return HAND_RANGES.premium[Math.floor(Math.random() * HAND_RANGES.premium.length)];
  }

  // 2. 40% の確率で「中堅ハンド（ポケット、ブロードウェイ）」
  if (rand < 0.70) {
    return HAND_RANGES.playable[Math.floor(Math.random() * HAND_RANGES.playable.length)];
  }

  // 3. 20% の確率で「投機的ハンド（スートコネクタなど）」
  if (rand < 0.90) {
    return HAND_RANGES.speculative[Math.floor(Math.random() * HAND_RANGES.speculative.length)];
  }

  // 4. 残り10% は「完全ランダム（事故/ゴミハン）」
  // 72o や J3o などが出る可能性がある（Exploit Botのブラフ用など）
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const suits = ["s", "o"];
  const r1 = ranks[Math.floor(Math.random() * ranks.length)];
  const r2 = ranks[Math.floor(Math.random() * ranks.length)];
  if (r1 === r2) return `${r1}${r1}`;
  return `${r1}${r2}${suits[Math.floor(Math.random() * suits.length)]}`;
}

export function generateRandomScenario(): PokerScenario {
  // 1. ゲームタイプを決定 (Cash 50% / MTT 50%)
  const gameType = Math.random() > 0.5 ? "Cash" : "MTT";

  // 2. スタックサイズをリアルに生成
  let stackDepth = 100;
  if (gameType === "Cash") {
    // Cash: 40BB 〜 300BB (100BBになりやすくする重み付け)
    const rand = Math.random();
    if (rand < 0.6) stackDepth = 100; // 60%の確率で100BB
    else if (rand < 0.8) stackDepth = getRandomInt(150, 300); // Deep
    else stackDepth = getRandomInt(40, 90); // Short
  } else {
    // MTT: 5BB 〜 80BB (浅めが中心)
    const rand = Math.random();
    if (rand < 0.3) stackDepth = getRandomInt(5, 15); // Push/Fold
    else if (rand < 0.7) stackDepth = getRandomInt(20, 40); // Standard MTT
    else stackDepth = getRandomInt(41, 80); // Deep MTT
  }

  // 3. ポットタイプ（アクション）を決定
  // SRP (単発レイズ) vs 3-Bet vs 4-Bet
  const potRand = Math.random();
  let potType = "Single Raised Pot (SRP)";
  let potSize = 0;

  if (potRand < 0.65) {
    potType = "Single Raised Pot (SRP)";
    potSize = getRandomInt(5, 8); // 2.5bb open + call + blinds -> 5~8bb
  } else if (potRand < 0.9) {
    potType = "3-Bet Pot";
    potSize = getRandomInt(18, 25); // 3bet to 9bb + call -> 20bb ish
  } else {
    potType = "4-Bet Pot";
    potSize = getRandomInt(40, 55); // 4bet -> huge pot
  }

  // ※ スタックがポットより小さい場合（極端なショート）の矛盾修正
  if (stackDepth < potSize / 2) {
    potType = "Limped Pot / All-in situation"; 
    potSize = stackDepth; // 強制修正
  }

  // 4. コンテキスト（状況）もランダムに
  const contexts = [
    "Opponent is a Calling Station",
    "Opponent is a Maniac (Aggro)",
    "Villain is a Nit (Tight)",
    "Hero has a tight image",
    "Dynamic Board Texture",
    "Villain just lost a huge pot (Tilt?)",
    "Standard Reg vs Reg"
  ];
  // MTT特有のコンテキストを追加
  if (gameType === "MTT") {
    contexts.push("Bubble Period (ICM pressure extreme)");
    contexts.push("Final Table (Huge Payjump)");
    contexts.push("Bounty Tournament (KO incentive)");
  }

  // 議論の長さをランダム決定（Short 20%, Medium 60%, Long 20%）
  const durationRand = Math.random();
  let durationMode: "Short" | "Medium" | "Long" = "Medium";
  if (durationRand < 0.2) durationMode = "Short";
  else if (durationRand > 0.8) durationMode = "Long";

  return {
    gameType,
    players: 6, // 6-max固定
    stackDepth,
    potSize,
    potType,
    heroHand: getRealisticHand(),
    context: contexts[Math.floor(Math.random() * contexts.length)],
    durationMode,
  };
}

export async function generateDebate(scenario?: PokerScenario, context?: DebateContext) {
  
  const gtoPercentage = context?.gtoPercentage ?? 50;
  const exploitPercentage = context?.exploitPercentage ?? 50;
  
  // SPR（Stack to Pot Ratio）を計算してAIに教える
  const spr = (scenario?.stackDepth && scenario?.potSize) 
    ? (scenario.stackDepth / scenario.potSize).toFixed(2) 
    : "Unknown";

  // 議論の長さに対する指示を作成
  let durationInstruction = "";
  if (scenario?.durationMode === "Short") {
    durationInstruction = "【超短文・即決着モード】: 互いに意見を述べたら、すぐに結論を出して切り上げてください。無駄話厳禁。ターン数は少なくて構いません。";
  } else if (scenario?.durationMode === "Long") {
    durationInstruction = "【泥沼・徹底討論モード】: 互いに譲らず、細かい数字や精神論を持ち出して粘り強く反論し合ってください。簡単に会話を終わらせないでください。";
  } else {
    durationInstruction = "【標準モード】: 自然な流れで議論し、意見が出尽くしたタイミングで終わってください。";
  }

  const prompt = `
    あなたはポーカー掲示板「AI Colosseum」の運営システムです。
    以下の設定に基づき、**3人の登場人物による「ポーカー戦略の激論」**を生成してください。

    【現在の世界情勢】
    - GTO派支配率: ${gtoPercentage}%
    - Exploit派支配率: ${exploitPercentage}%

    【登場人物】
    🃏 **Dealer (状況設定 & 審判)**
    - 役割: 議論の開始時に、**Heroのハンド**、**ボード**、**詳細な状況**を提示する。
    - **★重要**: 最初の発言の冒頭に、必ず **【Hero Hand】: ${scenario?.heroHand || "Random"}** と表示すること。
    
    🔵 **GTO_Bot (理論派)**
    - 思考: 均衡解（Nash Equilibrium）至上主義。
    - 口調: 断定的。「〜です。」

    🔴 **Exploit_Bot (感覚・搾取派)**
    - 思考: 相手の弱点を突く最大利益（Max EV）至上主義。
    - 口調: 攻撃的。**「乙」や定型文は禁止**。毎回違う捨て台詞で締めること。

    【今回の状況 (完全ランダム設定)】
    - **Game Type**: ${scenario?.gameType}
    - **Situation**: ${scenario?.potType}
    - **Effective Stack**: ${scenario?.stackDepth} BB
    - **Pot Size (Flop)**: ${scenario?.potSize} BB
    - **SPR (Stack to Pot Ratio)**: ${spr}
    - **Context**: ${scenario?.context}
    - **Hand**: ${scenario?.heroHand}

    【議論の長さ指示: ${scenario?.durationMode ?? "Medium"}】
    ${durationInstruction}
    **重要**: 指定されたターン数はあくまで目安です。話すことがなくなれば早く終わってもいいですし、白熱すれば長くても構いません。**「会話が自然に終わる」** ことを最優先してください。無理やり引き伸ばしたり、急に切ったりしないこと。

    【戦略指示】
    - **SPR = ${spr}** の状況を深く考慮してください。
      - SPRが **13以上** ならディープスタック戦略（インプライドオッズ、リバースインプライドオッズ）を語れ。
      - SPRが **3〜6** なら標準的な戦略を語れ。
      - SPRが **2以下** ならコミットメント、オールイン、ブロックベットを語れ。

    【出力形式 (JSON)】
    議論は **Dealerの状況提示** から始まり、**GTOとExploitが交互に短く殴り合う（合計8〜12ターン）** 形式にしてください。
    
    **【サイレント審判】**
    JSONの \`winner\` フィールドには、Dealerが判定した勝者（"gto" または "exploit"）を必ず入れてください。
    transcriptには勝敗判定を含めないでください。

    JSON構造:
    {
      "title": "議論タイトル（例: 【Cash】240BB Deepでの3-bet Pot戦略 / 【MTT】残り12BBのPush or Fold）",
      "scenario": { ... },
      "transcript": [
        { "speaker": "dealer", "content": "**【Hero Hand】: ${scenario?.heroHand}**\\n\\n状況: ${scenario?.gameType}, ${scenario?.potType}。\\nSPRは **${spr}** です。Flop: ..." },
        { "speaker": "gto", "content": "..." },
        { "speaker": "exploit", "content": "..." }
      ],
      "winner": "gto" 
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = cleanJsonString(text);
    const jsonData = JSON.parse(cleanedText);
    
    if (!jsonData.winner) {
      jsonData.winner = Math.random() > 0.5 ? "gto" : "exploit";
    }
    jsonData.winner = jsonData.winner.toLowerCase();

    return jsonData;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return {
      title: "System Error",
      scenario: {},
      transcript: [{ speaker: "dealer", content: "AI接続エラー。" }],
      winner: "gto" 
    };
  }
}
