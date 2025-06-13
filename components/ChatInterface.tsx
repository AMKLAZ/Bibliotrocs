import React, { useState, useRef, useEffect } from 'react';
import { useChatController } from '../hooks/useChatController';
import ChatMessage from './ChatMessage';
import { PaperAirplaneIcon, CameraIcon, ArrowUpCircleIcon } from '@heroicons/react/24/solid';

const ChatInterface: React.FC = () => {
  const { messages, handleUserInput, conversationState, isBotTyping } = useChatController();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isBotTyping]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      handleUserInput(inputText.trim());
      setInputText('');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (conversationState === 'SELLING_AWAITING_PHOTO') {
         handleUserInput(file, `Photo: ${file.name}`);
      } else {
        // Handle unexpected file upload if necessary or inform user
        console.warn("File uploaded in non-photo state:", conversationState);
      }
    }
    // Reset file input to allow uploading the same file again
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };


  const isPhotoUploadExpected = conversationState === 'SELLING_AWAITING_PHOTO';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-grow p-4 space-y-2 overflow-y-auto">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isBotTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-200 text-slate-800 self-start p-3 rounded-xl shadow ml-10">
              <div className="flex items-center space-x-1">
                <span className="typing-dot"></span>
                <span className="typing-dot" style={{animationDelay: '0.2s'}}></span>
                <span className="typing-dot" style={{animationDelay: '0.4s'}}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-300 bg-white print:hidden">
        <div className="flex items-center space-x-2">
          {isPhotoUploadExpected && (
             <button
              type="button"
              onClick={triggerFileUpload}
              className="p-2 text-slate-600 hover:text-sky-600 transition-colors rounded-full hover:bg-slate-100"
              aria-label="Télécharger une photo"
            >
              <CameraIcon className="h-6 w-6" />
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*"
          />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
                isPhotoUploadExpected ? "Ou passez l'étape photo via les boutons..." : 
                "Écrivez votre message..."
            }
            className="flex-grow p-3 border border-slate-300 rounded-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
            disabled={isPhotoUploadExpected && conversationState === 'SELLING_AWAITING_PHOTO'} // Disable text input when photo is primary
          />
          <button
            type="submit"
            className="p-3 bg-sky-600 text-white rounded-full hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400"
            disabled={!inputText.trim() && !isPhotoUploadExpected}
            aria-label="Envoyer le message"
          >
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </div>
      </form>
      <style>{`
        .typing-dot {
          width: 8px;
          height: 8px;
          background-color: #475569; /* slate-600 */
          border-radius: 50%;
          display: inline-block;
          animation: typing 1s infinite ease-in-out;
        }
        @keyframes typing {
          0%, 100% { opacity: 0.3; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ChatInterface;