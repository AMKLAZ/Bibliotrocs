import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { Book, BuyRequest, AppNotification } from '../types';
import { SERVICE_FEE, WHATSAPP_CONTACT_NUMBER } from '../constants';
import { 
  addBookToFirestore, 
  addBuyRequestToFirestore, 
  getBooksFromFirestore, 
  getBuyRequestsFromFirestore,
  updateBuyRequestInFirestore
} from '../services/livresService';
import { fileToBase64 } from '../utils/fileUtils';

interface BookContextType {
  booksForSale: Book[];
  buyRequests: BuyRequest[];
  notifications: AppNotification[];
  addBookForSale: (bookData: Omit<Book, 'id' | 'status' | 'photoPreviewUrl'> & { photoFile?: File }) => Promise<Book>;
  addBuyRequest: (requestData: Omit<BuyRequest, 'id' | 'status'>) => Promise<{ newRequest: BuyRequest, matchedBook?: Book }>;
  listAvailableBooks: () => Book[];
  clearNotification: (id: string) => void;
  addNotificationManual: (notification: Omit<AppNotification, 'id'>) => void;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const generateId = (): string => crypto.randomUUID(); // Still useful for notifications

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [fetchedBooks, fetchedRequests] = await Promise.all([
          getBooksFromFirestore(),
          getBuyRequestsFromFirestore()
        ]);
        setBooksForSale(fetchedBooks);
        setBuyRequests(fetchedRequests);
      } catch (error) {
        console.error("Failed to load data from Firestore:", error);
        addNotificationManual({ type: 'error', message: "Erreur de chargement des données. Veuillez vérifier votre connexion." });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []); // addNotificationManual removed from dependency array to avoid loop, it's stable

  const addNotificationManual = useCallback((notification: Omit<AppNotification, 'id'>) => {
    setNotifications(prev => [...prev, { ...notification, id: generateId() }]);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addBookForSale = useCallback(async (bookData: Omit<Book, 'id' | 'status' | 'photoPreviewUrl'> & { photoFile?: File }): Promise<Book> => {
    let photoPreviewUrlForDb: string | undefined = undefined;
    if (bookData.photoFile) {
      try {
        photoPreviewUrlForDb = await fileToBase64(bookData.photoFile);
      } catch (error) {
        console.error("Error converting file to base64:", error);
        // Potentially notify user or proceed without image
        addNotificationManual({type: 'error', message: "Erreur lors du traitement de l'image."});
      }
    }

    const bookToSave: Omit<Book, 'id' | 'photoFile'> = {
      ...bookData,
      status: 'available',
      photoPreviewUrl: photoPreviewUrlForDb, // This will be the base64 data URL
    };
    
    const newBook = await addBookToFirestore(bookToSave);
    setBooksForSale(prev => [...prev, newBook]);
    addNotificationManual({ type: 'success', message: `Livre "${newBook.title}" ajouté avec succès ! Le prix affiché sera de ${newBook.sellerPrice + SERVICE_FEE}F CFA.` });

    const adminEmailSubject = `Nouveau livre en vente: ${newBook.title}`;
    const adminEmailBody = `
Un nouveau livre a été mis en vente sur BiblioTroc:
Titre: ${newBook.title}, Classe: ${newBook.classLevel}, Éditeur: ${newBook.publisher}, Année: ${newBook.editionYear}
Prix vendeur: ${newBook.sellerPrice} F CFA, Prix affiché: ${newBook.sellerPrice + SERVICE_FEE} F CFA
Vendeur: ${newBook.sellerName}, Email: ${newBook.sellerEmail}, Tel: ${newBook.sellerPhone}
${photoPreviewUrlForDb ? "Une photo du livre a été fournie." : "Aucune photo fournie."}
Cordialement, L'équipe BiblioTroc`;
    simulateSendAdminEmail(adminEmailSubject, adminEmailBody.trim());

    const matchingRequests = buyRequests.filter(req => 
      req.status === 'pending' &&
      req.title.toLowerCase() === newBook.title.toLowerCase() &&
      req.classLevel.toLowerCase() === newBook.classLevel.toLowerCase() &&
      req.publisher.toLowerCase() === newBook.publisher.toLowerCase() &&
      req.editionYear === newBook.editionYear
    );

    for (const req of matchingRequests) {
      addNotificationManual({
        type: 'match',
        message: `Bonne nouvelle ! Le livre "${newBook.title}" que vous avez demandé est maintenant disponible.`,
        bookDetails: newBook,
        totalPrice: newBook.sellerPrice + SERVICE_FEE,
        contactNumber: WHATSAPP_CONTACT_NUMBER,
        buyerEmail: req.buyerEmail,
      });
      await updateBuyRequestInFirestore(req.id, { status: 'notified' });
      setBuyRequests(prevReqs => prevReqs.map(r => r.id === req.id ? { ...r, status: 'notified' } : r));
    }
    return newBook;
  }, [buyRequests, addNotificationManual]);

  const addBuyRequest = useCallback(async (requestData: Omit<BuyRequest, 'id' | 'status'>): Promise<{ newRequest: BuyRequest, matchedBook?: Book }> => {
    const requestToSave: Omit<BuyRequest, 'id'> = {
      ...requestData,
      status: 'pending',
    };
    
    let newRequest = await addBuyRequestToFirestore(requestToSave);

    const adminEmailSubjectRequest = `Nouvelle demande d'achat: ${newRequest.title}`;
    const adminEmailBodyRequest = `
Nouvelle demande d'achat sur BiblioTroc:
Titre: ${newRequest.title}, Classe: ${newRequest.classLevel}, Éditeur: ${newRequest.publisher}, Année: ${newRequest.editionYear}
Acheteur: Email: ${newRequest.buyerEmail}, Tel: ${newRequest.buyerPhone}
Cordialement, L'équipe BiblioTroc`;
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
      await updateBuyRequestInFirestore(newRequest.id, { status: 'notified' });
      newRequest = { ...newRequest, status: 'notified' };
      setBuyRequests(prev => [...prev.filter(r => r.id !== newRequest.id), newRequest]); // Update or add
      return { newRequest, matchedBook };
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
  
  // No need for URL.revokeObjectURL for base64 data URLs in booksForSale anymore.
  // The temporary blob URLs are handled in useChatController.

  return (
    <BookContext.Provider value={{ 
        booksForSale, 
        buyRequests, 
        notifications, 
        addBookForSale, 
        addBuyRequest, 
        listAvailableBooks, 
        clearNotification, 
        addNotificationManual,
        isLoading 
      }}>
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