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

/** AIの表記ゆれをフロントが期待する "gto" | "exploit" | "dealer" | "noob" に正規化 */
function normalizeSpeaker(speaker: unknown): "gto" | "exploit" | "dealer" | "noob" {
  const s = typeof speaker === "string" ? speaker.toLowerCase().trim() : "";
  if (s === "gto" || s === "gto_bot" || s.startsWith("gto")) return "gto";
  if (s === "exploit" || s === "exploit_bot" || s.startsWith("exploit")) return "exploit";
  if (s === "noob" || s === "noob_bot" || s.startsWith("noob")) return "noob";
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
    以下の設定に基づき、**3人の登場人物による「ポーカー戦略の議論」**の【最初の会話】を生成してください。

    【現在の世界情勢】
    - GTO派支配率: ${gtoPercentage}%
    - Exploit派支配率: ${exploitPercentage}%

    【登場人物の設定（4人体制）】
    
    🃏 **Dealer** (進行役)
    - 役割: 状況説明のみ。
    - **出力ルール**: 冒頭に **【Hero Hand】: ${heroHand}** と書き、続けて「有効スタックは ${stackDepth}BB です」と状況を簡潔に説明する。

    🟢 **noob** (Noob_Bot / 初心者)
    - **speakerキー**: "noob"
    - **性格**: 専門用語がわからない。ハンドの強さだけで突っ走る。数学が嫌い。愛すべき馬鹿キャラクター。「A持ってるから強気で行こうぜ！」「なんで降りるの？」といった**直感的で素人丸出しの発言**をする。
    - **役割**: **視聴者の代弁者**。GTOやExploitの話についていけず、頓珍漢な質問をして、彼らに解説させるきっかけを作る。
    
    🔵 **gto** (GTO_Bot / 理論派)
    - **speakerキー**: "gto"
    - **性格**: 均衡解至上主義。Noobの素人発言を論理的（数学的）に訂正し、教え諭そうとする。

    🔴 **exploit** (Exploit_Bot / 搾取派)
    - **speakerキー**: "exploit"
    - **性格**: 搾取至上主義。口が悪い。Noobの甘い考えを「カモだ」と嘲笑しつつ、実践的な勝ち方を教える。
    - 禁止ワード: クソ野郎, ゴミ, 死ね

    【状況】
    - ${gameType}, ${potType}
    - 有効スタック: ${stackDepth}BB (SPR: ${spr})
    - Hand: ${heroHand}
    - Context: ${scenario?.context || "Standard"}

    【議論の長さ: ${durationMode}】
    ${durationInstruction}

    【出力形式 (JSON)】
    JSON構造:
    {
      "title": "議論タイトル（状況を表すもの）",
      "scenario": { ... },
      "transcript": [
        { "speaker": "dealer", "content": "**【Hero Hand】: ${heroHand}**\\n\\n${gameType}でのプレイです。有効スタックは${stackDepth}BBです。..." },
        { "speaker": "noob", "content": "うおお！${heroHand}じゃん！これ絶対オールインでしょ！？" },
        { "speaker": "gto", "content": "落ち着いてください。そのSPRでオールインはEVマイナスです。なぜなら..." },
        { "speaker": "exploit", "content": "おいおい、そんなプレイしてたら破産するぞ。相手のレンジを見ろよ..." }
      ],
      "winner": "exploit" 
    }
    ※ transcriptは 3〜5ターン程度。Noobがボケて、両者がツッコむ流れを作ってください。speakerキーは大文字禁止です。
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = cleanJsonString(text);
    const jsonData = JSON.parse(cleanedText);
    
    // 安全装置: 勝者は gto または exploit のみ（noob/dealer の場合はランダムでどちらかへ）
    if (!jsonData.winner) {
      jsonData.winner = Math.random() > 0.5 ? "gto" : "exploit";
    }
    const winnerNorm = normalizeSpeaker(jsonData.winner);
    jsonData.winner = (winnerNorm === "dealer" || winnerNorm === "noob")
      ? (Math.random() > 0.5 ? "gto" : "exploit")
      : winnerNorm;

    // 安全装置: speakerを強制的に小文字化
    if (jsonData.transcript && Array.isArray(jsonData.transcript)) {
      const now = new Date().toISOString();
      jsonData.transcript = jsonData.transcript.map((t: any) => ({
        ...t,
        speaker: normalizeSpeaker(t.speaker ?? "dealer"),
        timestamp: now
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
  const recentHistory = currentTranscript.slice(-6);
  const historyStr = JSON.stringify(recentHistory);

  const prompt = `
    あなたはポーカー掲示板のAIです。以下の進行中の議論の【続き】を生成してください。
    
    【登場人物】
    - **noob**: 初心者（Noob_Bot）。専門用語がわからず、ハンドの強さで突っ走る。数学が嫌い。「え、どういうこと？」「それって強いの？」と素朴な疑問を投げる。
    - **gto**: 理論派。Noobに優しく（または冷たく）数値を解説する。
    - **exploit**: 搾取派。Noobに「現場のリアル」を教える。

    【状況】
    ${contextStr}

    【直近の会話】
    ${historyStr}

    【指示】
    - 前回の会話の流れを汲み取ってください。
    - **Noob Botを積極的に参加させてください**。彼が理解できない顔をすることで、GTOとExploitが「読者に向けて分かりやすく解説する」流れを作ってください。
    - 専門用語（SPR、Blockerなど）が出たら、Noobに「それ何？」と聞かせて、解説させてください。
    - 新たに **3〜5ターン分** の会話を追加してください。
    - Dealerは喋らせないでください。

    【出力形式 (JSON)】
    新しい会話部分のみを配列で返してください。
    Example:
    [
      { "speaker": "noob", "content": "なるほど！じゃあここはチェックが正解なんだ？" },
      { "speaker": "gto", "content": "その通りです。チェックレンジを守る必要があります。" },
      { "speaker": "exploit", "content": "ま、相手が弱いなら俺は打つけどな。" }
    ]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cleanedText = cleanJsonString(response.text());
    const newTranscript = JSON.parse(cleanedText);

    // スピーカーの小文字化処理
    if (Array.isArray(newTranscript)) {
      const now = new Date().toISOString();
      return newTranscript.map((t: any) => ({
        ...t,
        speaker: normalizeSpeaker(t.speaker ?? "gto"),
        timestamp: now
      }));
    }
    return [];
  } catch (error) {
    console.error("Continue Debate Error:", error);
    return [];
  }
}
