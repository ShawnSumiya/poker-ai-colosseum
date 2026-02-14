// check-models.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // 修正: listModels() は古いSDKや特定のバージョンでのみ動作することがあるため、
    // エラーが出る場合は直接 curl コマンド等での確認が必要ですが、まずはこれを試します。
    // SDKのバージョンによっては直接リスト取得メソッドがない場合があります。
    // その場合、モデル名を決め打ちで 'gemini-2.0-flash' にするのが早いです。
    console.log("Checking specific model availability...");
    
    const modelsToCheck = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-pro"
    ];

    for (const modelName of modelsToCheck) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✅ Available: ${modelName}`);
      } catch (error) {
        if (error.message.includes("404")) {
            console.log(`❌ Not Found: ${modelName}`);
        } else {
            console.log(`⚠️ Error with ${modelName}: ${error.message.split('\n')[0]}`);
        }
      }
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
