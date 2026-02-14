// test-key.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ここに新しいAPIキーを直接貼り付ける！
const apiKey = "AIzaSyBA-V66ThPfn770y7p-A2G7e2z747UzWzU";

const genAI = new GoogleGenerativeAI(apiKey);

async function check() {
  console.log("🔍 APIキーを診断中...");
  try {
    // 利用可能なモデル一覧を取得しようとする
    // 注意: SDKのバージョンによっては listModels がない場合があるので、
    // まずは代表的なモデルで単純な疎通確認を行います。

    const candidates = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-flash-002",
      "gemini-1.5-pro",
      "gemini-1.0-pro",
      "gemini-pro"
    ];

    console.log("以下のモデルへのアクセスをテストします:");

    for (const modelName of candidates) {
      process.stdout.write(`Testing ${modelName} ... `);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // 実際にリクエストを飛ばしてみる
        await model.generateContent("Test");
        console.log("✅ OK! (これを使えば動きます)");
      } catch (e) {
        if (e.message.includes("404")) {
          console.log("❌ Not Found (存在しない)");
        } else if (e.message.includes("429")) {
          console.log("⚠️ Limit Exceeded (存在するが枠がない)");
        } else {
          console.log(`❌ Error: ${e.message.split('\n')[0]}`);
        }
      }
    }

  } catch (error) {
    console.error("重大なエラー:", error);
  }
}

check();
