import React from 'react';
import ChatPage from './pages/ChatPage';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Navbar removed, main content is ChatPage */}
      <ChatPage />
      {/* Footer can be re-added here if desired, or kept out for a cleaner chat UI */}
      {/* 
      <footer className="bg-slate-800 text-white text-center p-4 print:hidden">
        <p>&copy; {new Date().getFullYear()} BiblioTroc. Tous droits réservés.</p>
      </footer> 
      */}
    </div>
  );
};

export default App;
