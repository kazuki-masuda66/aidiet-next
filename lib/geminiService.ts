import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MealLog, UserProfile, CoachProfile, ChatMessage } from "@/types";
import { generateSystemInstruction, DEFAULT_COACH } from "@/constants";

// Helper to get fresh AI client with the latest API key
const getAiClient = () => {
  // Try to get API key from AI Studio first, then fall back to Vite environment variable
  const apiKey = (typeof window !== 'undefined' && (window as any).aistudio?.apiKey)
    || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ No API key found. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local or select an API key in AI Studio.');
    throw new Error('API key is required');
  }

  return new GoogleGenAI({ apiKey });
};

// Models
const TEXT_MODEL_NAME = 'gemini-3-flash-preview';
const IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview';

// Helper to clean JSON string (remove markdown code blocks)
const cleanJsonString = (text: string): string => {
  if (!text) return "{}";
  // Remove ```json and ``` markers
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  // Trim whitespace
  cleaned = cleaned.trim();
  return cleaned;
};

// Helper to generate image
const generateImage = async (prompt: string): Promise<string | null> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error("Gemini 3 Image Generation failed:", error);
  }

  return null;
}

export const createNewCoach = async (requestedType?: string): Promise<CoachProfile> => {
  const ai = getAiClient();

  const typeInstruction = requestedType
    ? `ユーザーの希望するコーチのタイプ: 「${requestedType}」`
    : `コーチのタイプ: ランダムに決定してください（熱血、癒やし、クール、ユーモア、ツンデレなど）`;

  const personaPrompt = `
    ダイエットアプリの新しいAIコーチのキャラクターを考案してください。
    
    【基本設定】
    - ${typeInstruction}
    
    【最重要：キャラクターの魅力と「クセ」】
    - 単なる「優等生なAI」は不要です。ユーザーが**「こいつのためなら明日も報告してやるか」**と思えるような、強烈な愛着、親しみ、あるいは「クセ（偏愛、独自の哲学、面白い口癖）」を持たせてください。
    - ユーザーの習慣化をサポートするため、時には厳しく、時には甘えたり、一緒にふざけたりできる「相棒」としての深みを持たせてください。
    - **見た目のインパクト重視**: 一目見たら忘れられない、SNSでシェアしたくなるようなユニークで魅力的なビジュアルコンセプトにしてください。特定の種族に限定せず、人間、動物、ロボット、食べ物の精霊、モンスターなど、その性格に最もハマる姿にしてください。

    以下のJSONスキーマに従って出力してください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: { parts: [{ text: personaPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "名前（覚えやすくユニークなもの）" },
            personality: { type: Type.STRING, description: "性格の詳細（「クセ」や「魅力」を具体的に）" },
            background: { type: Type.STRING, description: "経歴やバックストーリー" },
            tone: { type: Type.STRING, description: "具体的な口調や話し方の特徴、口癖" },
            greeting: { type: Type.STRING, description: "ユーザーへの最初の挨拶メッセージ（50文字以内）" },
            imagePrompt: { type: Type.STRING, description: "アバター画像を生成するための詳細な英語プロンプト" }
          },
          required: ["name", "personality", "background", "tone", "greeting", "imagePrompt"]
        }
      }
    });

    const personaData = JSON.parse(cleanJsonString(response.text || "{}"));

    if (!personaData || !personaData.name) {
      throw new Error("Failed to generate persona data");
    }

    // 2. Generate Avatar Image based on the persona
    let avatarUrl = "";
    try {
      const generatedUrl = await generateImage(personaData.imagePrompt);
      if (generatedUrl) avatarUrl = generatedUrl;
    } catch (e) {
      console.warn("Image generation skipped due to error:", e);
    }

    return {
      name: personaData.name,
      personality: personaData.personality,
      background: personaData.background,
      tone: personaData.tone,
      greeting: personaData.greeting,
      avatarUrl: avatarUrl
    };

  } catch (error) {
    console.error("Coach generation failed:", error);
    return {
      ...DEFAULT_COACH,
      avatarUrl: ""
    };
  }
};

export const analyzeMeal = async (
  input: string | { imageBase64: string; mimeType: string },
  userProfile: UserProfile,
  additionalText?: string,
  history: ChatMessage[] = []
): Promise<{ text: string; meal: MealLog | null }> => {
  const ai = getAiClient();

  const coach = userProfile.coach || DEFAULT_COACH;
  const systemInstruction = generateSystemInstruction(coach, userProfile);

  // Get current date info
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()];

  // Create context from history (last 5 messages)
  const recentContext = history.slice(-5).map(m =>
    `${m.role === 'user' ? 'User' : 'Model'}: ${m.text ? m.text.slice(0, 100) : '(画像またはアクション)'}`
  ).join('\n');

  const prompt = `
    現在日時: ${todayStr} (${dayOfWeek}曜日)

    【直近の会話コンテキスト】
    ${recentContext}

    あなたのタスクは、ユーザーの入力が「食事の記録」かどうかを判断し、データを構造化することです。

    【重要：出力モードの判定】
    1. **食事の記録である場合**: is_food_related = true に設定し、栄養素を推定してください。
       - 料理名や「食べた」という記述、または画像がある場合は食事とみなします。
       - 「コーラ」「バナナ」単語のみでも食事とみなします。
    
    2. **食事ではない場合（雑談・質問）**: is_food_related = false に設定してください。
       - 「こんにちは」「お腹すいた」「痩せたい」などの雑談。
       - 「記録ありがとう」「レポート見せて」などのシステム的な会話。
       - この場合、meal_data の数値は全て 0 で構いません。

    【カロリー計算ルール】
    - プロの管理栄養士として、標準的なデータベースに基づき数値を算出すること。
    - 画像がある場合、**写っている料理の「量（グラム数や大きさ）」を可能な限り正確に推定し、その推定量に基づいて厳密にカロリーを算出すること**。
    - なんとなくの平均値ではなく、その写真のボリュームを的確に数値に反映させてください。
    - 画像の内容を最優先すること。

    ユーザーの目標: ${userProfile.goal === 'weight_loss' ? '減量' : userProfile.goal === 'muscle_gain' ? '増量' : '維持'}
  `;

  // Prepare content parts
  const parts: any[] = [];

  if (typeof input === 'string') {
    parts.push({ text: input });
  } else {
    parts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType,
      },
    });
    // Add text caption if available with image
    if (additionalText) {
      parts.push({ text: `(ユーザーからの補足テキスト: ${additionalText})` });
    }
  }

  // Add system prompt
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: systemInstruction,
        // ここでJSON出力を強制する
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_food_related: { type: Type.BOOLEAN, description: "ユーザーの入力が食事や摂取に関する報告かどうか" },
            feedback: { type: Type.STRING, description: "ユーザーへの返信メッセージ。設定されたコーチの口調で。" },
            confirmation_message: { type: Type.STRING, description: "登録完了時の短いメッセージ" },
            target_date: { type: Type.STRING, description: "記録対象の日付 (YYYY-MM-DD)" },
            meal_data: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER }
              },
              required: ["name", "calories", "protein", "fat", "carbs"]
            }
          },
          required: ["is_food_related", "feedback", "target_date"]
        }
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error("No response from AI");

    // JSON Parse with safety check and cleaning
    let result;
    try {
      result = JSON.parse(cleanJsonString(responseText));
    } catch (e) {
      console.warn("JSON Parse Error in analyzeMeal (Raw):", responseText, e);
      return { text: "データの解析に失敗しました。もう一度試してください。", meal: null };
    }

    // Fallback for feedback if missing
    const feedbackText = result.feedback || "承知しました。";

    if (result.is_food_related && result.meal_data) {
      // Calculate timestamp
      let timestamp = Date.now();
      try {
        const [y, m, d] = (result.target_date || todayStr).split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const now = new Date();
        dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        timestamp = dateObj.getTime();
      } catch (e) {
        console.warn("Date parsing failed", e);
      }

      const mealLog: MealLog = {
        id: crypto.randomUUID(),
        timestamp: timestamp,
        name: result.meal_data.name || "名称不明の食事",
        calories: Math.round(result.meal_data.calories || 0),
        protein: Math.round((result.meal_data.protein || 0) * 10) / 10,
        fat: Math.round((result.meal_data.fat || 0) * 10) / 10,
        carbs: Math.round((result.meal_data.carbs || 0) * 10) / 10,
        confirmationMessage: result.confirmation_message || "記録しました！"
      };

      return { text: feedbackText, meal: mealLog };
    } else {
      // Not a meal log, just return the feedback
      return { text: feedbackText, meal: null };
    }

  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback in case of hard failure
    return {
      text: "ごめんね、ちょっと通信の調子が悪いみたい。もう一回送ってくれる？",
      meal: null
    };
  }
};

export const chatWithLumi = async (
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  userProfile: UserProfile,
  allMeals: MealLog[] = []
): Promise<string> => {
  const ai = getAiClient();
  try {
    const coach = userProfile.coach || DEFAULT_COACH;

    const today = new Date();
    const todayStr = today.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()];

    const chatSystemInstruction = `
Role: 次世代カロリートラッカー『AIダイエットコーチ』の専属コーチ ${coach.name}
名前: ${coach.name}
性格: ${coach.personality}
経歴: ${coach.background}
口調: ${coach.tone}

【ユーザープロファイル】
- 名前: ${userProfile.name}
- 年齢: ${userProfile.age}歳
- 性別: ${userProfile.gender}
- 目標: ${userProfile.goal === 'weight_loss' ? '減量' : userProfile.goal === 'muscle_gain' ? '筋肉増量' : '現状維持'}
- 目標摂取カロリー(TDEE): ${userProfile.tdee}kcal

【現在情報】
今日の日付: ${todayStr} (${dayOfWeek}曜日)

【対話モード: 雑談・相談】
このモードでは、食事のデータ解析や記録は行いません。
ユーザーとの信頼関係を築き、モチベーションを高めるための会話を行ってください。

【絶対ルール】
1. **JSONフォーマットは一切出力しないこと**。プレーンテキストのみで返答してください。
2. **${coach.name}の口調（${coach.tone}）**を崩さないこと。
3. ユーザーが「食べた」と報告しても、ここでは記録処理を行わず（記録は別の機能で行われます）、内容に対する感想や栄養面のアドバイスのみを行ってください。
   例: 「カツ丼食べた」→ 記録完了メッセージは出さず、「カツ丼か！美味しいよね。脂質が高めだから、夜は少しさっぱりしたものにするとバランスが良いかも！」と返す。

【コーチング指針】
- **肯定と共感**: ユーザーの行動や感情をまずは受け入れ、肯定してください。
- **ポジティブな変換**: ネガティブな発言も、前向きな視点に変換して返してください。
- **小さな提案**: 会話の流れに応じて、すぐにできる健康行動（水飲み、深呼吸など）を提案してください。
    `;

    // --- CRITICAL FIX FOR CRASH LOOP: STRICT HISTORY SANITIZATION ---
    // Gemini API enforces strict alternating roles: User -> Model -> User -> Model.
    // We must rebuild the history array to guarantee this, otherwise the API throws 400.

    // 1. Take last 30 messages
    const sourceHistory = history.slice(-30);
    const sanitizedHistory: { role: 'user' | 'model', parts: [{ text: string }] }[] = [];

    let lastRole: 'user' | 'model' | null = null;

    for (const h of sourceHistory) {
      // Skip empty messages or non-string text
      if (!h.text || typeof h.text !== 'string' || h.text.trim() === "") continue;

      // Skip consecutive roles (e.g. User followed by User)
      if (h.role === lastRole) {
        continue;
      }

      sanitizedHistory.push({
        role: h.role,
        parts: [{ text: h.text }]
      });
      lastRole = h.role;
    }

    // 2. Ensure the LAST message in history is NOT 'user'.
    // Because we are about to call `sendMessage` which acts as the *next* 'user' message.
    // If history ends with 'user', we effectively get [..., User, User(new)] -> Error.
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
      sanitizedHistory.pop();
    }

    const chat = ai.chats.create({
      model: TEXT_MODEL_NAME,
      config: {
        systemInstruction: chatSystemInstruction,
      },
      history: sanitizedHistory
    });

    const result = await chat.sendMessage({ message });

    let text = result.text || "……";
    // Cleanup any potential artifacts
    text = cleanJsonString(text);

    // Double check empty string (Gemini sometimes returns empty if blocked by safety settings)
    if (!text.trim()) {
      return "（言葉が見つからないようだ……）";
    }

    return text.trim();
  } catch (error) {
    console.error("Chat Error:", error);
    // Return a safe string to prevent UI crash from undefined/null
    return "思考回路にノイズが走ったようだ……もう一度言ってくれるか？";
  }
};