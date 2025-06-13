import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import { UserIcon, CogIcon } from '@heroicons/react/24/solid'; // Using solid for bot icon

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const isSystem = message.sender === 'system';

  const baseStyles = "max-w-xl p-3 rounded-xl shadow";
  const userStyles = "bg-sky-500 text-white self-end ml-10";
  const botStyles = "bg-slate-200 text-slate-800 self-start mr-10";
  const systemStyles = "bg-transparent text-slate-500 text-xs italic self-center text-center my-2";

  if (isSystem) {
    return (
      <div className={`${baseStyles} ${systemStyles} w-full text-center`}>
        {typeof message.text === 'string' ? (
            <p dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br />') }} />
          ) : (
            message.text
          )}
      </div>
    )
  }

  return (
    <div className={`flex my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        {isBot && <CogIcon className="h-8 w-8 text-sky-600 bg-white rounded-full p-1 shadow" />}
        {isUser && <UserIcon className="h-8 w-8 text-white bg-sky-700 rounded-full p-1 shadow" />}
        <div className={`${baseStyles} ${isUser ? userStyles : botStyles}`}>
          {message.photoPreviewUrl && (
            <img src={message.photoPreviewUrl} alt="Preview" className="max-w-xs h-auto rounded-md mb-2" />
          )}
          {typeof message.text === 'string' ? (
            <p dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br />') }} />
          ) : (
            message.text
          )}
          {message.bookForDisplay && (
             <div className="mt-2 border-t border-slate-300 pt-2">
                <h4 className="font-semibold">{message.bookForDisplay.title}</h4>
                <p className="text-sm">Classe: {message.bookForDisplay.classLevel}</p>
                <p className="text-sm">Éditeur: {message.bookForDisplay.publisher}</p>
                <p className="text-sm">Année: {message.bookForDisplay.editionYear}</p>
                <p className="text-sm font-bold">Prix: {message.bookForDisplay.sellerPrice + 2000}F CFA</p>
                {message.bookForDisplay.photoPreviewUrl && 
                  <img src={message.bookForDisplay.photoPreviewUrl} alt={message.bookForDisplay.title} className="mt-1 rounded max-h-32"/>
                }
             </div>
          )}
          {message.actionButtons && message.actionButtons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actionButtons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${isBot ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-white hover:bg-slate-100 text-sky-600 border border-sky-500'}`}
                >
                  {button.text}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs mt-1 opacity-75">{message.timestamp.toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
