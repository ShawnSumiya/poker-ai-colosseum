import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || ""; 
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", 
  generationConfig: {
    responseMimeType: "application/json"
  }
});

// ★修正: 後方互換性のため、新しいフィールドに「?」をつけて任意項目にする
export type PokerScenario = {
  gameType: "Cash" | "MTT";
  players?: number;       // ★ ?を追加
  stackDepth: number;
  potSize?: number;       // ★ ?を追加
  potType?: string;       // ★ ?を追加
  heroHand?: string;
  board?: string;
  heroPosition?: string;
  villainPosition?: string;
  context?: string;
  durationMode?: "Short" | "Medium" | "Long"; // ★ ?を追加
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

export function generateRandomScenario(): PokerScenario {
  const gameType = Math.random() > 0.5 ? "Cash" : "MTT";
  
  let stackDepth = 100;
  if (gameType === "Cash") {
    const rand = Math.random();
    if (rand < 0.6) stackDepth = 100; 
    else if (rand < 0.8) stackDepth = getRandomInt(150, 300);
    else stackDepth = getRandomInt(40, 90);
  } else {
    const rand = Math.random();
    if (rand < 0.3) stackDepth = getRandomInt(5, 15);
    else if (rand < 0.7) stackDepth = getRandomInt(20, 40);
    else stackDepth = getRandomInt(41, 80);
  }

  const potRand = Math.random();
  let potType = "Single Raised Pot (SRP)";
  let potSize = 0;

  if (potRand < 0.65) {
    potType = "Single Raised Pot (SRP)";
    potSize = getRandomInt(5, 8);
  } else if (potRand < 0.9) {
    potType = "3-Bet Pot";
    potSize = getRandomInt(18, 25);
  } else {
    potType = "4-Bet Pot";
    potSize = getRandomInt(40, 55);
  }

  if (stackDepth < potSize / 2) {
    potType = "Limped Pot / All-in situation"; 
    potSize = stackDepth; 
  }

  const contexts = [
    "Opponent is a Calling Station",
    "Opponent is a Maniac (Aggro)",
    "Villain is a Nit (Tight)",
    "Hero has a tight image",
    "Dynamic Board Texture",
    "Villain just lost a huge pot (Tilt?)",
    "Standard Reg vs Reg"
  ];
  if (gameType === "MTT") {
    contexts.push("Bubble Period (ICM pressure extreme)", "Final Table (Huge Payjump)", "Bounty Tournament (KO incentive)");
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
  
  // ★安全策: undefinedの場合はデフォルト値を使う
  const potSize = scenario?.potSize ?? 0;
  const potType = scenario?.potType ?? "Standard Pot";
  const durationMode = scenario?.durationMode ?? "Medium";

  // SPR計算 (potSizeが0の場合は Unknown にする)
  const spr = (scenario?.stackDepth && potSize > 0) 
    ? (scenario.stackDepth / potSize).toFixed(2) 
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

    【今回の状況】
    - **Game Type**: ${scenario?.gameType}
    - **Situation**: ${potType}
    - **Effective Stack**: ${scenario?.stackDepth} BB
    - **Pot Size (Flop)**: ${potSize} BB
    - **SPR (Stack to Pot Ratio)**: ${spr}
    - **Context**: ${scenario?.context || "Standard"}
    - **Hand**: ${scenario?.heroHand || "Unknown"}

    【戦略指示】
    - **SPR = ${spr}** の状況を考慮してください。
      - SPRが13以上ならディープスタック戦略。
      - SPRが2以下ならコミットメント戦略。
    
    【議論の長さ指示: ${durationMode}】
    ${durationInstruction}

    【出力形式 (JSON)】
    議論は **Dealerの状況提示** から始まり、**GTOとExploitが交互に短く殴り合う** 形式にしてください。
    
    JSON構造:
    {
      "title": "議論タイトル",
      "scenario": { ... },
      "transcript": [
        { "speaker": "dealer", "content": "**【Hero Hand】: ...**\\n\\n状況..." },
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
