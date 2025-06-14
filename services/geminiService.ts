// services/geminiService.ts
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set in process.env. Gemini functionality in geminiService.ts will be impaired.");
}

// Initialize the Google AI client
// The exclamation mark asserts API_KEY is non-null for the SDK,
// but we've already logged an error if it's missing.
const ai = new GoogleGenAI({ apiKey: API_KEY! });
const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Sends a text prompt to the Gemini API and returns the generated text response.
 * @param prompt The text prompt to send to the model.
 * @returns A promise that resolves to the model's text response, or an error message.
 */
export async function sendPromptToGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    console.warn("Gemini API key not configured in geminiService.ts. Cannot send prompt.");
    return "Je suis désolé, ma configuration interne n'est pas complète pour répondre à cette demande. Veuillez contacter l'administrateur.";
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    // The most direct way to get the text response
    return response.text;

  } catch (error) {
    console.error("Erreur Gemini API dans sendPromptToGemini:", error);
    if (error instanceof Error && error.message.toLowerCase().includes("api key")) {
        return "Je suis désolé, il y a un problème avec la configuration d'accès au service d'IA. Veuillez contacter l'administrateur.";
    }
    // Return a message similar to the user's original error message preference
    return "Échec de la requête Gemini. Pas de réponse."; 
  }
}
