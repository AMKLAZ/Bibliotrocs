
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BookProvider } from './context/BookContext';
import { HashRouter } from 'react-router-dom';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("L'élément racine est introuvable.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <BookProvider>
        <App />
      </BookProvider>
    </HashRouter>
  </React.StrictMode>
);
