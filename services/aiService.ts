
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ExtractedBookInfo } from '../types';

// Ensure API_KEY is available in the environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Image analysis and text generation will not work reliably.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); 

const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

const extractBookInfoPrompt = `Vous êtes un assistant IA spécialisé dans l'analyse d'images de couvertures de livres scolaires.
Extrayez les informations suivantes de l'image fournie.
Répondez UNIQUEMENT avec un objet JSON. Ne fournissez aucune explication ou texte supplémentaire avant ou après le JSON.
Si une information n'est pas clairement visible ou identifiable, utilisez une chaîne vide "" comme valeur pour ce champ.

Les champs à extraire sont :
- "title": Le titre complet du livre.
- "classLevel": La classe ou le niveau scolaire (ex: "4ème", "Terminale A", "CM2").
- "publisher": La maison d'édition.
- "editionYear": L'année d'édition au format YYYY (ex: "2021").

Exemple de format JSON attendu :
{
  "title": "Mathématiques CIAM 3ème",
  "classLevel": "3ème",
  "publisher": "EDICEF",
  "editionYear": "2019"
}
`;

export const extractBookInfoFromImage = async (base64ImageData: string): Promise<ExtractedBookInfo | null> => {
  if (!API_KEY) {
    console.warn("Gemini API key not configured. Skipping image analysis.");
    return null;
  }
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg', 
        data: base64ImageData,
      },
    };
    const textPart = {
      text: extractBookInfoPrompt,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim(); 
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      const result: ExtractedBookInfo = {
        title: parsedData.title || "",
        classLevel: parsedData.classLevel || "",
        publisher: parsedData.publisher || "",
        editionYear: parsedData.editionYear || "",
      };
      return result;
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", e, "Raw response text:", response.text);
      return null;
    }
  } catch (error) {
    console.error("Error calling Gemini API for image analysis:", error);
    return null;
  }
};

export const generateTextFromApi = async (promptText: string): Promise<string> => {
  if (!API_KEY) {
    console.warn("Gemini API key not configured. Skipping text generation.");
    return "Je suis désolé, ma configuration interne n'est pas complète pour répondre à cette demande. Veuillez contacter l'administrateur de la plateforme.";
  }
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
      // No specific systemInstruction or thinkingConfig modification needed for general queries
      // Default thinkingConfig (enabled) is fine for quality.
    });
    
    return response.text;

  } catch (error) {
    console.error("Error calling Gemini API for text generation:", error);
    if (error instanceof Error && error.message.toLowerCase().includes("api key")) {
        return "Je suis désolé, il y a un problème avec la configuration d'accès au service d'IA. Veuillez contacter l'administrateur.";
    }
    return "Je suis désolé, une erreur est survenue lors de la tentative de génération de texte. Veuillez réessayer plus tard ou poser une autre question.";
  }
};
