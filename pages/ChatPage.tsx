import React from 'react';
import ChatInterface from '../components/ChatInterface';
import { APP_NAME } from '../constants';

const ChatPage: React.FC = () => {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="bg-sky-700 text-white p-4 shadow-md print:hidden">
        <h1 className="text-2xl font-bold text-center">{APP_NAME} - Votre Assistant BiblioTroc</h1>
      </header>
      <main className="flex-grow overflow-y-auto">
        <ChatInterface />
      </main>
    </div>
  );
};

export default ChatPage;
