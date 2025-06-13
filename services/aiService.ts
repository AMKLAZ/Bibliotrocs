import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ExtractedBookInfo } from '../types';

// Ensure API_KEY is available in the environment variables
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Image analysis will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); // API_KEY can be null if not set, handle this gracefully or ensure it's always there.

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
        mimeType: 'image/jpeg', // Assuming JPEG, adjust if necessary (e.g. image/png)
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
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Matches ```json ... ``` or ``` ... ```
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim(); // Extract content within fences
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      // Basic validation for expected fields (optional)
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
    console.error("Error calling Gemini API:", error);
    return null;
  }
};