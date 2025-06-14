import React from 'react';
import ChatPage from './pages/ChatPage';
import GeminiBox from './components/GeminiBox'; // Import GeminiBox

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <ChatPage />
      {/* Add a section for GeminiBox for direct API testing */}
      <div className="mt-auto print:hidden"> {/* Push to bottom, hide on print */}
        <GeminiBox />
      </div>
      {/* Footer can be re-added here if desired */}
    </div>
  );
};

export default App;
