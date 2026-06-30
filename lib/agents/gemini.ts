import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

let _model: ChatGoogleGenerativeAI | null = null;

export function getGeminiModel(): ChatGoogleGenerativeAI {
  if (!_model) {
    _model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
      maxOutputTokens: 2048,
    });
  }
  return _model;
}

export function getGeminiModelWithSearch() {
  // ponytail: googleSearch is the Gemini 2.0 grounding tool name for AI Studio
  return getGeminiModel().bind({ tools: [{ googleSearch: {} }] });
}
