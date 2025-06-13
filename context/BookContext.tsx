import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { Book, BuyRequest, AppNotification } from '../types';
import { SERVICE_FEE, WHATSAPP_CONTACT_NUMBER } from '../constants';

interface BookContextType {
  booksForSale: Book[];
  buyRequests: BuyRequest[];
  notifications: AppNotification[];
  addBookForSale: (bookData: Omit<Book, 'id' | 'status' | 'photoPreviewUrl'> & { photoFile?: File }) => Book; // Return the new book
  addBuyRequest: (requestData: Omit<BuyRequest, 'id' | 'status'>) => { newRequest: BuyRequest, matchedBook?: Book }; // Return request and match
  listAvailableBooks: () => Book[];
  clearNotification: (id: string) => void;
  addNotificationManual: (notification: Omit<AppNotification, 'id'>) => void; 
}

const BookContext = createContext<BookContextType | undefined>(undefined);

const ADMIN_EMAIL_RECIPIENTS = [
  "contacts@leslapinsbleus.site",
  "leslapinsbleus20212022@gmail.com",
  "danxome.production@gmail.com"
];

const simulateSendAdminEmail = (subject: string, body: string) => {
  console.log("==========================================================");
  console.log("SIMULATION D'ENVOI D'EMAIL ADMINISTRATEUR");
  console.log(`Destinataires: ${ADMIN_EMAIL_RECIPIENTS.join(", ")}`);
  console.log(`Sujet: ${subject}`);
  console.log("Corps de l'email:\n--------------------");
  console.log(body);
  console.log("==========================================================");
};


export const BookProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [booksForSale, setBooksForSale] = useState<Book[]>([]);
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const generateId = (): string => crypto.randomUUID();

  const addNotificationManual = useCallback((notification: Omit<AppNotification, 'id'>) => {
    setNotifications(prev => [...prev, { ...notification, id: generateId() }]);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addBookForSale = useCallback((bookData: Omit<Book, 'id' | 'status' | 'photoPreviewUrl'> & { photoFile?: File }): Book => {
    let photoPreviewUrl: string | undefined = undefined;
    if (bookData.photoFile) {
      photoPreviewUrl = URL.createObjectURL(bookData.photoFile);
    }

    const newBook: Book = {
      ...bookData,
      id: generateId(),
      status: 'available',
      photoPreviewUrl,
    };
    
    setBooksForSale(prev => [...prev, newBook]);
    addNotificationManual({ type: 'success', message: `Livre "${newBook.title}" ajouté avec succès ! Le prix affiché sera de ${newBook.sellerPrice + SERVICE_FEE}F CFA.` });

    // Simulate admin email notification
    const adminEmailSubject = `Nouveau livre en vente: ${newBook.title}`;
    const adminEmailBody = `
Un nouveau livre a été mis en vente sur BiblioTroc:

Titre: ${newBook.title}
Classe/Niveau: ${newBook.classLevel}
Maison d'édition: ${newBook.publisher}
Année d'édition: ${newBook.editionYear}
Prix vendeur: ${newBook.sellerPrice} F CFA
Prix affiché à l'acheteur (avec frais): ${newBook.sellerPrice + SERVICE_FEE} F CFA

Informations du vendeur:
Nom: ${newBook.sellerName}
Email: ${newBook.sellerEmail}
Téléphone: ${newBook.sellerPhone}
${newBook.photoFile ? "Une photo du livre a été fournie." : "Aucune photo fournie."}

Cordialement,
L'équipe BiblioTroc
    `;
    simulateSendAdminEmail(adminEmailSubject, adminEmailBody.trim());


    const matchingRequests = buyRequests.filter(req => 
      req.status === 'pending' &&
      req.title.toLowerCase() === newBook.title.toLowerCase() &&
      req.classLevel.toLowerCase() === newBook.classLevel.toLowerCase() &&
      req.publisher.toLowerCase() === newBook.publisher.toLowerCase() &&
      req.editionYear === newBook.editionYear
    );

    matchingRequests.forEach(req => {
      addNotificationManual({
        type: 'match',
        message: `Bonne nouvelle ! Le livre "${newBook.title}" que vous avez demandé est maintenant disponible.`,
        bookDetails: newBook,
        totalPrice: newBook.sellerPrice + SERVICE_FEE,
        contactNumber: WHATSAPP_CONTACT_NUMBER,
        buyerEmail: req.buyerEmail,
      });
      setBuyRequests(prevReqs => prevReqs.map(r => r.id === req.id ? { ...r, status: 'notified' } : r));
    });
    return newBook;
  }, [buyRequests, addNotificationManual]);

  const addBuyRequest = useCallback((requestData: Omit<BuyRequest, 'id' | 'status'>): { newRequest: BuyRequest, matchedBook?: Book } => {
    const newRequest: BuyRequest = {
      ...requestData,
      id: generateId(),
      status: 'pending',
    };
    
    // Simulate admin email notification for buy request
    const adminEmailSubjectRequest = `Nouvelle demande d'achat: ${newRequest.title}`;
    const adminEmailBodyRequest = `
Une nouvelle demande d'achat a été enregistrée sur BiblioTroc:

Titre recherché: ${newRequest.title}
Classe/Niveau: ${newRequest.classLevel}
Maison d'édition: ${newRequest.publisher}
Année d'édition souhaitée: ${newRequest.editionYear}

Informations de l'acheteur:
Email: ${newRequest.buyerEmail}
Téléphone: ${newRequest.buyerPhone}

Cordialement,
L'équipe BiblioTroc
    `;
    simulateSendAdminEmail(adminEmailSubjectRequest, adminEmailBodyRequest.trim());

    const matchedBook = booksForSale.find(book => 
      book.status === 'available' &&
      book.title.toLowerCase() === newRequest.title.toLowerCase() &&
      book.classLevel.toLowerCase() === newRequest.classLevel.toLowerCase() &&
      book.publisher.toLowerCase() === newRequest.publisher.toLowerCase() &&
      book.editionYear === newRequest.editionYear
    );

    if (matchedBook) {
      addNotificationManual({
        type: 'match',
        message: `Bonne nouvelle ! Le livre "${matchedBook.title}" que vous recherchez est disponible.`,
        bookDetails: matchedBook,
        totalPrice: matchedBook.sellerPrice + SERVICE_FEE,
        contactNumber: WHATSAPP_CONTACT_NUMBER,
        buyerEmail: newRequest.buyerEmail,
      });
      setBuyRequests(prev => [...prev, { ...newRequest, status: 'notified' }]);
      return { newRequest: {...newRequest, status: 'notified'}, matchedBook };
    } else {
      addNotificationManual({
        type: 'info',
        message: `Merci pour votre demande pour "${newRequest.title}". Nous vous contacterons par mail dès que ce livre sera disponible.`,
        buyerEmail: newRequest.buyerEmail
      });
      setBuyRequests(prev => [...prev, newRequest]);
      return { newRequest };
    }
  }, [booksForSale, addNotificationManual]);

  const listAvailableBooks = useCallback((): Book[] => {
    return booksForSale.filter(book => book.status === 'available');
  }, [booksForSale]);
  
  useEffect(() => {
    // Clean up Object URLs when component unmounts or booksForSale changes
    return () => {
      booksForSale.forEach(book => {
        if (book.photoPreviewUrl) {
          URL.revokeObjectURL(book.photoPreviewUrl);
        }
      });
    };
  }, [booksForSale]);


  return (
    <BookContext.Provider value={{ booksForSale, buyRequests, notifications, addBookForSale, addBuyRequest, listAvailableBooks, clearNotification, addNotificationManual }}>
      {children}
    </BookContext.Provider>
  );
};

export const useBookContext = (): BookContextType => {
  const context = useContext(BookContext);
  if (context === undefined) {
    throw new Error('useBookContext must be used within a BookProvider');
  }
  return context;
};