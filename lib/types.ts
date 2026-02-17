/**
 * ポーカーシチュエーションの型定義
 * DB上の json / jsonb 型を扱うためのインターフェース
 */
export interface PokerScenario {
  gameType?: string;
  stackDepth?: string;
  heroHand?: string;
  board?: string;
  heroPosition?: string;
  villainPosition?: string;
  action?: string;
  potSize?: string;
  [key: string]: unknown;
}

/**
 * 議論の1ターン
 */
export interface DebateTurn {
  speaker: "gto" | "exploit" | "dealer";
  content: string;
  timestamp?: string; // ISO 8601（生成・保存時の時刻）
}

/**
 * 議論のトランスクリプト（DebateTurnの配列）
 */
export type DebateTranscript = DebateTurn[];
