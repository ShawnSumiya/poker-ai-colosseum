import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || ""; 
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", 
  generationConfig: {
    responseMimeType: "application/json"
  }
});

// 型定義
export type PokerScenario = {
  gameType?: string;
  players?: number;
  stackDepth?: number | string;
  potSize?: number | string;
  potType?: string;
  heroHand?: string;
  board?: string;
  heroPosition?: string;
  villainPosition?: string;
  context?: string;
  durationMode?: "Short" | "Medium" | "Long";
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

/** AIの表記ゆれ（GTO, GTO_Bot, gto_bot 等）をフロントが期待する "gto" | "exploit" | "dealer" に正規化 */
function normalizeSpeaker(speaker: unknown): "gto" | "exploit" | "dealer" {
  const s = typeof speaker === "string" ? speaker.toLowerCase().trim() : "";
  if (s === "gto" || s === "gto_bot" || s.startsWith("gto")) return "gto";
  if (s === "exploit" || s === "exploit_bot" || s.startsWith("exploit")) return "exploit";
  return "dealer";
}

// ハンドレンジ定義
const HAND_RANGES = {
  premium: ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AJs", "KQs", "AKo", "AQo"],
  playable: ["99", "88", "77", "66", "55", "44", "33", "22", "ATs", "KJs", "KTs", "QJs", "QTs", "JTs", "AJo", "KQo", "KJo", "QJo"],
  speculative: ["T9s", "98s", "87s", "76s", "65s", "54s", "A9s", "A8s", "A7s", "A5s", "A4s", "A3s", "A2s", "K9s", "Q9s", "J9s"],
  trash: [] 
};

function getRealisticHand(): string {
  const rand = Math.random();
  if (rand < 0.30) return HAND_RANGES.premium[Math.floor(Math.random() * HAND_RANGES.premium.length)];
  if (rand < 0.70) return HAND_RANGES.playable[Math.floor(Math.random() * HAND_RANGES.playable.length)];
  if (rand < 0.90) return HAND_RANGES.speculative[Math.floor(Math.random() * HAND_RANGES.speculative.length)];
  
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const suits = ["s", "o"];
  const r1 = ranks[Math.floor(Math.random() * ranks.length)];
  const r2 = ranks[Math.floor(Math.random() * ranks.length)];
  if (r1 === r2) return `${r1}${r1}`;
  return `${r1}${r2}${suits[Math.floor(Math.random() * suits.length)]}`;
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// シナリオ生成ロジック
export function generateRandomScenario(): PokerScenario {
  const gameType = Math.random() > 0.5 ? "Cash" : "MTT";
  
  let stackDepth = 100;
  if (gameType === "Cash") {
    const rand = Math.random();
    if (rand < 0.6) stackDepth = 100; 
    else if (rand < 0.8) stackDepth = getRandomInt(150, 300); // Deep
    else stackDepth = getRandomInt(40, 90); // Short
  } else {
    // MTT
    const rand = Math.random();
    if (rand < 0.3) stackDepth = getRandomInt(10, 20);
    else if (rand < 0.7) stackDepth = getRandomInt(25, 50);
    else stackDepth = getRandomInt(51, 100);
  }

  const potRand = Math.random();
  let potType = "Single Raised Pot (SRP)";
  let potSize = 0;

  if (potRand < 0.65) {
    potType = "Single Raised Pot (SRP)";
    potSize = getRandomInt(5, 8);
  } else if (potRand < 0.9) {
    potType = "3-Bet Pot";
    potSize = getRandomInt(15, 25);
  } else {
    potType = "4-Bet Pot";
    potSize = getRandomInt(40, 60);
  }

  if (stackDepth < potSize / 2) {
    potType = "All-in situation"; 
    potSize = stackDepth; 
  }

  const contexts = [
    "Opponent is a Calling Station",
    "Opponent is a Maniac (Aggro)",
    "Villain is a Nit (Tight)",
    "Hero has a tight image",
    "Dynamic Board Texture",
    "Standard Reg vs Reg"
  ];
  if (gameType === "MTT") {
    contexts.push("Bubble Period (ICM pressure)", "Final Table", "Bounty Tournament");
  }

  const durationRand = Math.random();
  let durationMode: "Short" | "Medium" | "Long" = "Medium";
  if (durationRand < 0.2) durationMode = "Short";
  else if (durationRand > 0.8) durationMode = "Long";

  return {
    gameType,
    players: 6,
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
  
  // 値の正規化
  const gameType = scenario?.gameType || "Cash";
  const rawStackDepth = scenario?.stackDepth ?? 100;
  const stackDepth = Number(rawStackDepth);
  const rawPotSize = scenario?.potSize ?? 6;
  const potSize = Number(rawPotSize);
  const potType = scenario?.potType ?? "Single Raised Pot";
  const durationMode = scenario?.durationMode ?? "Medium";
  const heroHand = scenario?.heroHand || "Random Hand";

  // SPR計算
  const spr = (stackDepth && potSize > 0) 
    ? (stackDepth / potSize).toFixed(2) 
    : "Unknown";

  let durationInstruction = "";
  if (durationMode === "Short") {
    durationInstruction = "【超短文・即決着モード】: 互いに意見を述べたら、すぐに結論を出して切り上げてください。";
  } else if (durationMode === "Long") {
    durationInstruction = "【泥沼・徹底討論モード】: 互いに譲らず、細かい数字や精神論を持ち出して粘り強く反論し合ってください。";
  } else {
    durationInstruction = "【標準モード】: 自然な流れで議論し、意見が出尽くしたタイミングで終わってください。";
  }

  const prompt = `
    あなたはポーカー掲示板「AI Colosseum」の運営システムです。
    以下の設定に基づき、**3人の登場人物による「ポーカー戦略の激論」**を生成してください。

    【現在の世界情勢】
    - GTO派支配率: ${gtoPercentage}%
    - Exploit派支配率: ${exploitPercentage}%

    【登場人物の設定（厳守）】
    
    🃏 **Dealer (状況設定)**
    - 役割: 議論の開始時に状況を説明する。
    - **出力ルール**:
      - 冒頭に必ず **【Hero Hand】: ${heroHand}** と書くこと。
      - 状況説明では **「有効スタック: ${stackDepth}BB」** と明記すること。
      - Dealerは客観的な事実のみを述べ、SPRなどの専門用語で評価しないこと。
    
    🔵 **GTO_Bot (理論派)**
    - **speakerキー**: 必ず "gto" (すべて小文字) にすること。
    - 思考: 均衡解（Nash Equilibrium）至上主義。
    - 口調: 冷静、断定的。「〜です。」「頻度は〜%です。」

    🔴 **Exploit_Bot (感覚・搾取派)**
    - **speakerキー**: 必ず "exploit" (すべて小文字) にすること。
    - 思考: 相手の弱点を突く最大利益（Max EV）至上主義。
    - 口調: 攻撃的だが、**「クソ野郎」「死ね」などの汚い言葉は禁止**。「下手くそ」「臆病」といった知性のある煽り方をすること。
    - **禁止ワード**: クソ野郎, ゴミ, 死ね

    【今回のハンド状況】
    - Game: ${gameType}
    - Situation: ${potType}
    - **Effective Stack**: ${stackDepth} BB (重要)
    - Pot Size: ${potSize} BB
    - Context: ${scenario?.context || "Standard"}
    - Hand: ${heroHand}
    - (内部計算用SPR: ${spr})

    【戦略指示とSPRの扱い】
    - **Dealer**: SPRという単語を使わず、「有効スタック: ${stackDepth}BB」と表記してください。
    - **GTO / Exploit**: 議論の中で **「SPR (Stack-to-Pot Ratio)」** という用語を使って議論しても構いません。（例：「SPRが低いのでコミットすべき」「SPRが高いのでインプライドオッズがある」など）
    - **SPR = ${spr}** の状況を考慮し、ディープならインプライドオッズを、ショートならコミットを意識した議論をさせてください。

    【議論の長さ: ${durationMode}】
    ${durationInstruction}

    【出力形式 (JSON)】
    JSON構造を厳守してください。speakerキーは大文字禁止です。
    
    JSON Example:
    {
      "title": "88 vs Aggro in 3-Bet Pot",
      "scenario": { ... },
      "transcript": [
        { "speaker": "dealer", "content": "**【Hero Hand】: ${heroHand}**\\n\\n状況は${gameType}です。有効スタック(BB): ${stackDepth}BBのディープスタック戦です..." },
        { "speaker": "gto", "content": "この状況ではチェックが安定です。" },
        { "speaker": "exploit", "content": "SPRを見てみろよ、ここで打たないとかありえないだろ。" }
      ],
      "winner": "exploit" 
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = cleanJsonString(text);
    const jsonData = JSON.parse(cleanedText);
    
    // 安全装置: 勝者が空ならランダム
    if (!jsonData.winner) {
      jsonData.winner = Math.random() > 0.5 ? "gto" : "exploit";
    }
    const winnerNorm = normalizeSpeaker(jsonData.winner);
    jsonData.winner = winnerNorm === "dealer" ? "gto" : winnerNorm;

    // 安全装置: speakerを強制的に小文字化
    if (jsonData.transcript && Array.isArray(jsonData.transcript)) {
      const now = new Date().toISOString(); // ★現在時刻を取得
      jsonData.transcript = jsonData.transcript.map((t: any) => ({
        ...t,
        speaker: t.speaker ? t.speaker.toLowerCase() : "dealer",
        timestamp: now // ★全発言に「生成された時間」を付与
      }));
    }

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

/** 既存スレッドの続きを書く関数 */
export async function continueDebate(
  currentTranscript: { speaker?: unknown; content?: string }[],
  scenario: PokerScenario
) {
  const contextStr = JSON.stringify(scenario);
  const recentHistory = currentTranscript.slice(-5);
  const historyStr = JSON.stringify(recentHistory);

  const prompt = `
    あなたはポーカー掲示板のAIです。以下の進行中の議論の【続き】を生成してください。
    
    【状況】
    ${contextStr}

    【直近の会話】
    ${historyStr}

    【指示】
    - 前回の会話の流れを汲み取り、さらに深く、熱い議論を展開してください。
    - GTO派とExploit派がお互いの主張の矛盾を突き、具体的なレンジやアクション頻度、心理戦について語り合ってください。
    - **SPR** という用語を積極的に使い、スタックサイズに基づいた議論を行ってください。
    - Exploit Botは口が悪く、GTO Botは冷静です。
    - 新たに **3〜5ターン分** の会話を追加してください。
    - Dealerは喋らせないでください。

    【出力形式 (JSON)】
    新しい会話部分のみを配列で返してください。
    Example:
    [
      { "speaker": "gto", "content": "しかし、そのSPRではチェックレイズの頻度は低くなります。" },
      { "speaker": "exploit", "content": "うるさいな、相手が降りすぎるなら打つだけだ。" }
    ]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cleanedText = cleanJsonString(response.text());
    const newTranscript = JSON.parse(cleanedText);

    // スピーカーの小文字化処理
    if (Array.isArray(newTranscript)) {
      const now = new Date().toISOString(); // ★現在時刻を取得
      return newTranscript.map((t: any) => ({
        ...t,
        speaker: t.speaker ? t.speaker.toLowerCase() : "gto",
        timestamp: now // ★追加分の発言に「生成された時間」を付与
      }));
    }
    return [];
  } catch (error) {
    console.error("Continue Debate Error:", error);
    return [];
  }
}
