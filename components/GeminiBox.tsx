import React, { useState } from "react";
import { sendPromptToGemini } from "../services/geminiService";

function GeminiBox() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setResponse(""); // Clear previous response
    try {
      const result = await sendPromptToGemini(prompt);
      setResponse(result);
    } catch (err) {
      // Error handling is done within sendPromptToGemini, which returns a message
      // If sendPromptToGemini itself throws, this catch is a fallback.
      setResponse("Erreur critique lors de la requête Gemini.");
      console.error("Error in GeminiBox handleSend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 m-4 bg-white rounded-lg shadow-xl border border-slate-200">
      <h2 className="text-xl font-semibold text-slate-700 mb-4">Test Direct Gemini API</h2>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Posez une question à Gemini..."
        rows={4}
        className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow mb-3 shadow-sm"
        disabled={isLoading}
      />
      <button 
        onClick={handleSend}
        className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400"
        disabled={isLoading || !prompt.trim()}
      >
        {isLoading ? "Envoi en cours..." : "Envoyer à Gemini"}
      </button>
      {response && (
        <div className="mt-4">
            <h3 className="text-md font-semibold text-slate-600 mb-1">Réponse de Gemini:</h3>
            <pre className="p-3 bg-slate-50 border border-slate-200 rounded-md whitespace-pre-wrap break-all text-sm text-slate-700 max-h-96 overflow-y-auto shadow-sm">{response}</pre>
        </div>
      )}
    </div>
  );
}

export default GeminiBox;
