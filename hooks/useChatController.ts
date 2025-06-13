import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, ConversationState, SellingFormData, BuyingFormData, Book as BookType, AppNotification, ExtractedBookInfo } from '../types';
import { useBookContext } from '../context/BookContext';
import { SERVICE_FEE, WHATSAPP_CONTACT_NUMBER } from '../constants';
import { extractBookInfoFromImage } from '../services/aiService'; 
import { fileToBase64 } from '../utils/fileUtils';

const generateId = () => crypto.randomUUID();

export const useChatController = () => {
  const { addBookForSale, addBuyRequest, listAvailableBooks, notifications, clearNotification, addNotificationManual, isLoading: isContextLoading } = useBookContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('IDLE');
  const [sellingData, setSellingData] = useState<SellingFormData>({});
  const [buyingData, setBuyingData] = useState<BuyingFormData>({});
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [tempExtractedInfo, setTempExtractedInfo] = useState<ExtractedBookInfo | null>(null);


  const addMessage = useCallback((text: string | React.ReactNode, sender: ChatMessage['sender'], photoPreviewUrl?: string, bookForDisplay?: BookType, actionButtons?: ChatMessage['actionButtons']) => {
    setMessages(prev => [...prev, { id: generateId(), text, sender, timestamp: new Date(), photoPreviewUrl, bookForDisplay, actionButtons }]);
    if (sender === 'bot') setIsBotTyping(false);
  }, []);
  
  const simulateBotTyping = async (duration: number = 700) => {
    setIsBotTyping(true);
    await new Promise(resolve => setTimeout(resolve, duration));
  };

  const handleImageInfoConfirmation = useCallback(async (confirmed: boolean) => {
    addMessage(confirmed ? "Oui, c'est correct." : "Non, je vais les saisir manuellement.", 'user');
    await simulateBotTyping();

    if (confirmed && tempExtractedInfo) {
      setSellingData(prev => ({
        ...prev, // Keeps photoFile and photoPreviewUrl
        title: tempExtractedInfo.title || '',
        classLevel: tempExtractedInfo.classLevel || '',
        publisher: tempExtractedInfo.publisher || '',
        editionYear: tempExtractedInfo.editionYear || '',
      }));
      setTempExtractedInfo(null); // Clear temporary info
      addMessage(`Parfait ! Quel est le prix que vous souhaitez pour ce livre (en F CFA) ? \nUn complément de ${SERVICE_FEE}F CFA sera ajouté comme frais de service.`, 'bot');
      setConversationState('SELLING_AWAITING_PRICE');
    } else {
      setTempExtractedInfo(null); // Clear temporary info
      setSellingData(prev => ({ // Reset potentially pre-filled fields if any, keep photo
        ...prev,
        title: undefined,
        classLevel: undefined,
        publisher: undefined,
        editionYear: undefined,
      }));
      addMessage("D'accord. Quel est le titre complet du livre ?", 'bot');
      setConversationState('SELLING_AWAITING_TITLE');
    }
  }, [addMessage, tempExtractedInfo, simulateBotTyping]);


  const handleUserInput = useCallback(async (input: string | File, rawInputText?: string) => {
    if (typeof input !== 'string' && !(input instanceof File)) return;

    const userMessageText = typeof input === 'string' ? input : (rawInputText || "Photo envoyée");
    const photoPreviewForUserMessage = typeof input !== 'string' ? URL.createObjectURL(input) : undefined;
    
    addMessage(userMessageText, 'user', photoPreviewForUserMessage);
    await simulateBotTyping();

    switch (conversationState) {
      case 'AWAITING_ACTION':
        const actionText = typeof input === 'string' ? input.toLowerCase() : '';
        if (actionText.includes('vendre')) (getProcessInitialAction())('sell');
        else if (actionText.includes('acheter')) (getProcessInitialAction())('buy');
        else if (actionText.includes('parcourir') || actionText.includes('voir') || actionText.includes('liste')) (getProcessInitialAction())('browse');
        else addMessage("Je n'ai pas compris. Vous pouvez 'vendre', 'acheter' ou 'parcourir' les livres.", 'bot');
        break;

      case 'SELLING_AWAITING_PHOTO':
        if (input instanceof File) {
          addMessage("Photo reçue. Je vais essayer d'analyser l'image pour récupérer les informations du livre...", 'bot');
          setIsBotTyping(true); // Show typing while processing
          setSellingData(prev => ({ ...prev, photoFile: input, photoPreviewUrl: photoPreviewForUserMessage }));
          try {
            const base64FullString = await fileToBase64(input);
            const base64Data = base64FullString.split(',')[1]; // Get only the base64 part
            const extractedInfo = await extractBookInfoFromImage(base64Data);

            if (extractedInfo && (extractedInfo.title || extractedInfo.publisher || extractedInfo.classLevel || extractedInfo.editionYear)) {
              setTempExtractedInfo(extractedInfo); // Store for confirmation step
              let confirmationMessage = "J'ai analysé l'image et voici ce que j'ai pu lire :\n";
              if (extractedInfo.title) confirmationMessage += `Titre: ${extractedInfo.title}\n`;
              else confirmationMessage += `Titre: (non détecté)\n`;
              if (extractedInfo.classLevel) confirmationMessage += `Classe: ${extractedInfo.classLevel}\n`;
              else confirmationMessage += `Classe: (non détectée)\n`;
              if (extractedInfo.publisher) confirmationMessage += `Maison d'édition: ${extractedInfo.publisher}\n`;
              else confirmationMessage += `Maison d'édition: (non détectée)\n`;
              if (extractedInfo.editionYear) confirmationMessage += `Année d'édition: ${extractedInfo.editionYear}\n`;
              else confirmationMessage += `Année d'édition: (non détectée)\n`;
              confirmationMessage += "\nCes informations sont-elles correctes ?";
              
              addMessage(confirmationMessage, 'bot', undefined, undefined, [
                { text: "Oui, c'est correct", onClick: () => handleImageInfoConfirmation(true) },
                { text: "Non, je les saisis", onClick: () => handleImageInfoConfirmation(false) }
              ]);
              setConversationState('SELLING_AWAITING_CONFIRMATION_FROM_IMAGE');
            } else {
              addMessage("Je n'ai pas pu extraire automatiquement les informations de l'image, ou les informations sont incomplètes. Quel est le titre complet du livre ?", 'bot');
              setConversationState('SELLING_AWAITING_TITLE');
            }
          } catch (error) {
            console.error("Error processing image with AI:", error);
            addMessage("Une erreur est survenue lors de l'analyse de l'image. Quel est le titre complet du livre ?", 'bot');
            setConversationState('SELLING_AWAITING_TITLE');
          } finally {
            setIsBotTyping(false); // Hide typing
          }
        } else {
          addMessage("Veuillez télécharger une image ou cliquer sur 'Passer l'étape photo'.", 'bot');
        }
        break;
      
      case 'SELLING_AWAITING_CONFIRMATION_FROM_IMAGE':
        // This state is now primarily handled by button clicks routed to `handleImageInfoConfirmation`.
        // If user types instead of clicking a button:
        addMessage("Veuillez utiliser les boutons 'Oui' ou 'Non' pour confirmer les informations.", 'bot');
        break;

      case 'SELLING_AWAITING_TITLE':
        setSellingData(prev => ({ ...prev, title: input as string }));
        addMessage("Noté. Quelle est la classe ou le niveau scolaire concerné ? (ex: 4e, Terminale A)", 'bot');
        setConversationState('SELLING_AWAITING_CLASS_LEVEL');
        break;
      case 'SELLING_AWAITING_CLASS_LEVEL':
        setSellingData(prev => ({ ...prev, classLevel: input as string }));
        addMessage("Quelle est la maison d'édition ?", 'bot');
        setConversationState('SELLING_AWAITING_PUBLISHER');
        break;
      case 'SELLING_AWAITING_PUBLISHER':
        setSellingData(prev => ({ ...prev, publisher: input as string }));
        addMessage("Quelle est l'année d’édition ? (ex: 2021)", 'bot');
        setConversationState('SELLING_AWAITING_EDITION_YEAR');
        break;
      case 'SELLING_AWAITING_EDITION_YEAR':
        setSellingData(prev => ({ ...prev, editionYear: input as string }));
        addMessage(`Quel est le prix que vous souhaitez pour ce livre (en F CFA) ? \nUn complément de ${SERVICE_FEE}F CFA sera ajouté à ce prix comme frais de service pour l'acheteur.`, 'bot');
        setConversationState('SELLING_AWAITING_PRICE');
        break;
      case 'SELLING_AWAITING_PRICE':
        const price = parseFloat(input as string);
        if (isNaN(price) || price <= 0) {
          addMessage("Veuillez entrer un prix valide (nombre positif).", 'bot');
          break;
        }
        setSellingData(prev => ({ ...prev, sellerPrice: price }));
        addMessage("Quel est votre nom complet ?", 'bot');
        setConversationState('SELLING_AWAITING_SELLER_NAME');
        break;
      case 'SELLING_AWAITING_SELLER_NAME':
        setSellingData(prev => ({ ...prev, sellerName: input as string }));
        addMessage("Quelle est votre adresse email ?", 'bot');
        setConversationState('SELLING_AWAITING_SELLER_EMAIL');
        break;
      case 'SELLING_AWAITING_SELLER_EMAIL':
        if (!(input as string).includes('@') || !(input as string).includes('.')) {
             addMessage("Veuillez entrer une adresse email valide.", 'bot');
             break;
        }
        setSellingData(prev => ({ ...prev, sellerEmail: input as string }));
        addMessage("Quel est votre numéro de téléphone ?", 'bot');
        setConversationState('SELLING_AWAITING_SELLER_PHONE');
        break;
      case 'SELLING_AWAITING_SELLER_PHONE':
        // Ensure all required fields are present before saving
        const finalSellingData = { ...sellingData, sellerPhone: input as string };
        if (!finalSellingData.title || !finalSellingData.classLevel || !finalSellingData.publisher || !finalSellingData.editionYear || !finalSellingData.sellerPrice || !finalSellingData.sellerName || !finalSellingData.sellerEmail || !finalSellingData.sellerPhone) {
            addMessage("Il semble que des informations soient manquantes. Veuillez vérifier et recommencer le processus de vente si besoin.", 'bot');
            setConversationState('AWAITING_ACTION');
            // Provide main action buttons again
            await simulateBotTyping(300);
            (getHandleInitialMessage())();
            break;
        }
        
        try {
          const bookToSellPayload = {
            title: finalSellingData.title!,
            classLevel: finalSellingData.classLevel!,
            publisher: finalSellingData.publisher!,
            editionYear: finalSellingData.editionYear!,
            sellerPrice: finalSellingData.sellerPrice!,
            sellerName: finalSellingData.sellerName!,
            sellerEmail: finalSellingData.sellerEmail!,
            sellerPhone: finalSellingData.sellerPhone, // Already set
            photoFile: finalSellingData.photoFile, // photoFile is already in sellingData
          };
          const savedBook = await addBookForSale(bookToSellPayload);
          
          addMessage(`Merci ! Votre livre "${savedBook.title}" a été mis en vente. Le prix demandé est de ${savedBook.sellerPrice}F CFA. L'acheteur verra un prix de ${savedBook.sellerPrice + SERVICE_FEE}F CFA.`, 'bot', savedBook.photoPreviewUrl); // savedBook.photoPreviewUrl will be base64 from DB
          
          if(sellingData.photoPreviewUrl && sellingData.photoPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(sellingData.photoPreviewUrl); // Clean up blob URL for user's own preview
          }

        } catch (error) {
          console.error("Error selling book:", error);
          addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la mise en vente."});
        }
        setSellingData({}); // Reset form data
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un autre livre", onClick: () => { addMessage("Je veux vendre un autre livre.", 'user'); (getProcessInitialAction())('sell'); } },
            { text: "Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); (getProcessInitialAction())('buy'); } },
            { text: "Voir les livres", onClick: () => { addMessage("Je veux voir les livres.", 'user'); (getProcessInitialAction())('browse'); } },
        ]);
        break;

      case 'BUYING_AWAITING_TITLE':
        setBuyingData(prev => ({ ...prev, title: input as string }));
        addMessage("Quelle est la classe ou le niveau scolaire ?", 'bot');
        setConversationState('BUYING_AWAITING_CLASS_LEVEL');
        break;
      case 'BUYING_AWAITING_CLASS_LEVEL':
        setBuyingData(prev => ({ ...prev, classLevel: input as string }));
        addMessage("Quelle est la maison d’édition souhaitée ?", 'bot');
        setConversationState('BUYING_AWAITING_PUBLISHER');
        break;
      case 'BUYING_AWAITING_PUBLISHER':
        setBuyingData(prev => ({ ...prev, publisher: input as string }));
        addMessage("Quelle est l'année d’édition souhaitée ?", 'bot');
        setConversationState('BUYING_AWAITING_EDITION_YEAR');
        break;
      case 'BUYING_AWAITING_EDITION_YEAR':
        setBuyingData(prev => ({ ...prev, editionYear: input as string }));
        addMessage("Quelle est votre adresse email ?", 'bot');
        setConversationState('BUYING_AWAITING_BUYER_EMAIL');
        break;
      case 'BUYING_AWAITING_BUYER_EMAIL':
         if (!(input as string).includes('@') || !(input as string).includes('.')) {
             addMessage("Veuillez entrer une adresse email valide.", 'bot');
             break;
        }
        setBuyingData(prev => ({ ...prev, buyerEmail: input as string }));
        addMessage("Quel est votre numéro de téléphone ?", 'bot');
        setConversationState('BUYING_AWAITING_BUYER_PHONE');
        break;
      case 'BUYING_AWAITING_BUYER_PHONE':
        setBuyingData(prev => ({ ...prev, buyerPhone: input as string }));
        try {
            const requestData = {
                title: buyingData.title!,
                classLevel: buyingData.classLevel!,
                publisher: buyingData.publisher!,
                editionYear: buyingData.editionYear!,
                buyerEmail: buyingData.buyerEmail!,
                buyerPhone: input as string,
            };
            await addBuyRequest(requestData); 
        } catch (error) {
            console.error("Error submitting buy request:", error);
            addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la soumission de votre demande."});
        }
        
        setBuyingData({});
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); (getProcessInitialAction())('sell'); } },
            { text: "Faire une autre demande", onClick: () => { addMessage("Je veux faire une autre demande.", 'user'); (getProcessInitialAction())('buy'); } },
            { text: "Voir les livres", onClick: () => { addMessage("Je veux voir les livres.", 'user'); (getProcessInitialAction())('browse'); } },
        ]);
        break;
      
      default:
        addMessage("Je suis un peu perdu. Essayons autre chose.", 'bot');
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        (getHandleInitialMessage())();
        break;
    }

    // Clean up temporary blob URL for user's own message preview if it wasn't used for SELLING_AWAITING_PHOTO's sellingData.photoPreviewUrl
    // This is now handled by sellingData.photoPreviewUrl being set correctly.
    // The revoke for the final book selling message is after addBookForSale if sellingData.photoPreviewUrl was a blob.
  }, [conversationState, addMessage, sellingData, buyingData, addBookForSale, addBuyRequest, addNotificationManual, listAvailableBooks, handleImageInfoConfirmation]);


  const processInitialAction = useCallback(async (action: 'sell' | 'buy' | 'browse') => {
    await simulateBotTyping();
    if (action === 'sell') {
      setConversationState('SELLING_AWAITING_PHOTO');
      setSellingData({}); // Reset selling data for new sale
      setTempExtractedInfo(null); // Clear any old extracted info
      addMessage("Super ! Pour commencer, veuillez envoyer une photo de la couverture du livre.", 'bot', undefined, undefined, [
        { text: "Passer l'étape photo", onClick: async () => {
            addMessage("Je passe l'étape photo.", 'user');
            await simulateBotTyping();
            setSellingData(prev => ({ ...prev, photoFile: undefined, photoPreviewUrl: undefined }));
            setConversationState('SELLING_AWAITING_TITLE');
            addMessage("D'accord, passons à la suite. Quel est le titre complet du livre ?", 'bot');
        }}
      ]);
    } else if (action === 'buy') {
      setConversationState('BUYING_AWAITING_TITLE');
      setBuyingData({});
      addMessage("Entendu. Quel est le titre complet du livre que vous recherchez ?", 'bot');
    } else if (action === 'browse') {
      setConversationState('BROWSING_BOOKS');
      const availableBooks = listAvailableBooks();
      if (availableBooks.length > 0) {
        addMessage(`Voici les livres actuellement disponibles (${availableBooks.length}) :`, 'bot');
        availableBooks.forEach(book => {
          // The price shown to buyer includes service fee, book.sellerPrice is just seller's take
          const displayBook = {...book, sellerPrice: book.sellerPrice}; // For BookCard display, it adds fee.
          // For chat message text, explicitly show total price
          const totalPriceForDisplay = book.sellerPrice + SERVICE_FEE;
          addMessage(`${book.title} - Prix total: ${totalPriceForDisplay}F CFA`, 'bot', undefined, displayBook);
        });
      } else {
        addMessage("Il n'y a aucun livre disponible pour le moment. Revenez plus tard !", 'bot');
      }
      
      await simulateBotTyping(300);
      setConversationState('AWAITING_ACTION');
      addMessage("Que souhaitez-vous faire d'autre ?", 'bot', undefined, undefined, [
          { text: "Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); processInitialAction('sell'); } },
          { text: "Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); processInitialAction('buy'); } },
          { text: "Voir les livres", onClick: () => { addMessage("Je veux voir les livres.", 'user'); processInitialAction('browse'); } },
      ]);
    }
  }, [addMessage, listAvailableBooks, simulateBotTyping]); // Removed handleUserInput from deps, processInitialAction calls itself or sets state

  const handleInitialMessage = useCallback(async () => {
    await simulateBotTyping();
    addMessage(
      "Bonjour ! Je suis BiblioTroc, votre assistant pour l'échange et la vente de livres scolaires. Que souhaitez-vous faire aujourd'hui ?",
      'bot',
      undefined,
      undefined,
      [
        { text: "📚 Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); processInitialAction('sell'); } },
        { text: "🛒 Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); processInitialAction('buy'); } },
        { text: "🔍 Parcourir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); processInitialAction('browse'); } },
      ]
    );
    setConversationState('AWAITING_ACTION');
  }, [addMessage, processInitialAction, simulateBotTyping]);

  const getProcessInitialAction = () => processInitialAction;
  const getHandleInitialMessage = () => handleInitialMessage;


  useEffect(() => {
    if (messages.length === 0 && !isContextLoading) {
      handleInitialMessage();
    }
  }, [handleInitialMessage, messages.length, isContextLoading]);

  useEffect(() => {
    if (notifications.length > 0) {
      notifications.forEach(async (notif) => {
        await simulateBotTyping(300);
        let messageText = notif.message;
        let bookForSystemMessage: BookType | undefined = undefined;

        if (notif.type === 'match' && notif.bookDetails) {
            messageText += `\nLivre: ${notif.bookDetails.title}\nPrix Total: ${notif.totalPrice}F CFA.`; // totalPrice includes SERVICE_FEE
            messageText += `\nContactez le vendeur/acheteur via WhatsApp: ${notif.contactNumber}`;
            if (notif.buyerEmail) messageText += `\n(Notification également envoyée à ${notif.buyerEmail})`;
            // For system messages displaying a book, ensure the price shown is the total price
            bookForSystemMessage = {...notif.bookDetails, sellerPrice: notif.totalPrice! - SERVICE_FEE}; // Back-calculate sellerPrice for BookCard if it expects that
        } else if (notif.type === 'success' && notif.bookDetails && notif.totalPrice) {
            // This case might be for successful sale listing if we want to show the book again
            // messageText is already good from BookContext: `Livre "${newBook.title}" ajouté avec succès ! Le prix affiché sera de ${newBook.sellerPrice + SERVICE_FEE}F CFA.`
            bookForSystemMessage = notif.bookDetails;
        }
        addMessage(messageText, 'system', undefined, bookForSystemMessage); // Send bookForSystemMessage here
        clearNotification(notif.id);
      });
    }
  }, [notifications, clearNotification, addMessage, simulateBotTyping]);


  useEffect(() => {
    if (isContextLoading && messages.length === 0) {
        // Optional: addMessage("Chargement des données...", "system"); 
    }
  }, [isContextLoading, messages.length, addMessage]);


  return { messages, handleUserInput, conversationState, isBotTyping };
};