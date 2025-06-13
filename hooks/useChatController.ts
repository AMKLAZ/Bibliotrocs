
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, ConversationState, SellingFormData, BuyingFormData, Book as BookType, AppNotification } from '../types';
import { useBookContext } from '../context/BookContext';
import { SERVICE_FEE, WHATSAPP_CONTACT_NUMBER } from '../constants';

const generateId = () => crypto.randomUUID();

export const useChatController = () => {
  const { addBookForSale, addBuyRequest, listAvailableBooks, notifications, clearNotification, addNotificationManual } = useBookContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('IDLE');
  const [sellingData, setSellingData] = useState<SellingFormData>({});
  const [buyingData, setBuyingData] = useState<BuyingFormData>({});
  const [isBotTyping, setIsBotTyping] = useState(false);

  // Refs for latest callback versions
  const processInitialActionRef = useRef<typeof processInitialAction>(null!);
  const handleUserInputRef = useRef<typeof handleUserInput>(null!);
  const handleInitialMessageRef = useRef<typeof handleInitialMessage>(null!);


  const addMessage = useCallback((text: string | React.ReactNode, sender: ChatMessage['sender'], photoPreviewUrl?: string, bookForDisplay?: BookType, actionButtons?: ChatMessage['actionButtons']) => {
    setMessages(prev => [...prev, { id: generateId(), text, sender, timestamp: new Date(), photoPreviewUrl, bookForDisplay, actionButtons }]);
    if (sender === 'bot') setIsBotTyping(false);
  }, []);
  
  const simulateBotTyping = useCallback(async (duration: number = 700) => {
    setIsBotTyping(true);
    await new Promise(resolve => setTimeout(resolve, duration));
    // isBotTyping will be set to false when addMessage(..., 'bot') is called
  }, []);


  const processInitialAction = useCallback(async (action: 'sell' | 'buy' | 'browse') => {
    await simulateBotTyping();
    if (action === 'sell') {
      setConversationState('SELLING_AWAITING_PHOTO');
      setSellingData({});
      addMessage("Super ! Pour commencer, veuillez envoyer une photo de la couverture du livre.", 'bot', undefined, undefined, [
        { text: "Passer l'étape photo", onClick: () => {
            setSellingData(prev => ({ ...prev, photoFile: undefined, photoPreviewUrl: undefined }));
            setConversationState('SELLING_AWAITING_TITLE');
            // User message for skipping photo
            addMessage("J'ai cliqué sur 'Passer l'étape photo'.", 'user');
            simulateBotTyping().then(() => {
                 addMessage("D'accord, passons à la suite. Quel est le titre complet du livre ?", 'bot');
            });
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
          addMessage(`${book.title}`, 'bot', undefined, book);
        });
      } else {
        addMessage("Il n'y a aucun livre disponible pour le moment. Revenez plus tard !", 'bot');
      }
      await simulateBotTyping(300);
      setConversationState('AWAITING_ACTION');
      addMessage("Que souhaitez-vous faire d'autre ?", 'bot', undefined, undefined, [
          { text: "Vendre un livre", onClick: () => handleUserInputRef.current("vendre") },
          { text: "Acheter un livre", onClick: () => handleUserInputRef.current("acheter") },
          { text: "Voir les livres", onClick: () => handleUserInputRef.current("parcourir") },
      ]);
    }
  }, [addMessage, listAvailableBooks, simulateBotTyping, setConversationState, setSellingData, setBuyingData]);

  const handleInitialMessage = useCallback(async () => {
    await simulateBotTyping();
    addMessage(
      "Bonjour ! Je suis BiblioTroc, votre assistant pour l'échange et la vente de livres scolaires. Que souhaitez-vous faire aujourd'hui ?",
      'bot',
      undefined,
      undefined,
      [
        { text: "📚 Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); processInitialActionRef.current('sell'); } },
        { text: "🛒 Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); processInitialActionRef.current('buy'); } },
        { text: "🔍 Parcourir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); processInitialActionRef.current('browse'); } },
      ]
    );
    setConversationState('AWAITING_ACTION');
  }, [addMessage, simulateBotTyping, setConversationState]);

  const handleUserInput = useCallback(async (input: string | File, rawInputText?: string) => {
    if (typeof input !== 'string' && !(input instanceof File)) return;

    const userMessageText = typeof input === 'string' ? input : (rawInputText || "Photo envoyée");
    
    if (rawInputText !== undefined || typeof input === 'string' || input instanceof File) {
       // Avoid adding user message if it's an internal call like from action buttons that already added a user message
       const isButtonClickCall = (rawInputText === "vendre" || rawInputText === "acheter" || rawInputText === "parcourir") && typeof input === 'string' && input === rawInputText;
       if (!isButtonClickCall && (rawInputText !== "vendre" && rawInputText !== "acheter" && rawInputText !== "parcourir")) {
           let photoUrl;
           if (input instanceof File) {
             photoUrl = URL.createObjectURL(input);
           }
           addMessage(userMessageText, 'user', photoUrl);
            // Temporary URL for user message display, revoke if it's a file
           if (photoUrl && input instanceof File) {
            //   URL.revokeObjectURL(photoUrl); // Revoke after a short delay or manage carefully
           }
       }
    }
    
    await simulateBotTyping();

    switch (conversationState) {
      case 'AWAITING_ACTION':
        const actionText = typeof input === 'string' ? input.toLowerCase() : '';
        if (actionText.includes('vendre')) processInitialActionRef.current('sell');
        else if (actionText.includes('acheter')) processInitialActionRef.current('buy');
        else if (actionText.includes('parcourir') || actionText.includes('voir') || actionText.includes('liste')) processInitialActionRef.current('browse');
        else addMessage("Je n'ai pas compris. Vous pouvez 'vendre', 'acheter' ou 'parcourir' les livres.", 'bot');
        break;

      case 'SELLING_AWAITING_PHOTO':
        if (input instanceof File) {
          const photoPreviewUrl = URL.createObjectURL(input);
          setSellingData(prev => ({ ...prev, photoFile: input, photoPreviewUrl }));
          addMessage("Photo reçue ! Quel est le titre complet du livre ?", 'bot', photoPreviewUrl); 
          setConversationState('SELLING_AWAITING_TITLE');
        } else {
          addMessage("Veuillez télécharger une image ou cliquer sur 'Passer l'étape photo'.", 'bot');
        }
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
        setSellingData(prev => ({ ...prev, sellerPhone: input as string }));
        try {
          const bookToSell = {
            title: sellingData.title!,
            classLevel: sellingData.classLevel!,
            publisher: sellingData.publisher!,
            editionYear: sellingData.editionYear!,
            sellerPrice: sellingData.sellerPrice!,
            sellerName: sellingData.sellerName!,
            sellerEmail: sellingData.sellerEmail!,
            sellerPhone: input as string, // This is the final piece of sellingData
            photoFile: sellingData.photoFile,
          };
          const newBook = addBookForSale(bookToSell); // addBookForSale now returns the created book with its own photoPreviewUrl
          
          // Main success message from the bot, with final book details
          addMessage(`Merci ! Votre livre "${newBook.title}" a été mis en vente. Votre prix est de ${newBook.sellerPrice}F CFA. L'acheteur verra un prix de ${newBook.sellerPrice + SERVICE_FEE}F CFA.`, 'bot', newBook.photoPreviewUrl);
          
          // Clean up the temporary photoPreviewUrl stored in sellingData if it came from a File object
          if (sellingData.photoPreviewUrl && sellingData.photoFile) {
            URL.revokeObjectURL(sellingData.photoPreviewUrl);
          }
          // The BookContext will manage the newBook.photoPreviewUrl lifecycle.
          // Notification about admin email simulation will be handled by BookContext and displayed as a system message.

        } catch (error) {
          console.error("Error selling book:", error);
          addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la mise en vente."});
        }
        setSellingData({}); // Reset form data
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un autre livre", onClick: () => { addMessage("Je veux vendre un autre livre.", 'user'); processInitialActionRef.current('sell'); } },
            { text: "Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); processInitialActionRef.current('buy'); } },
            { text: "Voir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); processInitialActionRef.current('browse'); } },
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
            addBuyRequest(requestData); // This will trigger notifications from BookContext
        } catch (error) {
            console.error("Error submitting buy request:", error);
            addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la soumission de votre demande."});
        }
        
        setBuyingData({});
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); processInitialActionRef.current('sell'); } },
            { text: "Faire une autre demande d'achat", onClick: () => { addMessage("Je veux acheter un autre livre.", 'user'); processInitialActionRef.current('buy'); } },
            { text: "Voir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); processInitialActionRef.current('browse'); } },
        ]);
        break;
      
      default:
        addMessage("Je suis un peu perdu. Essayons autre chose.", 'bot');
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        handleInitialMessageRef.current(); // Use ref here
        break;
    }
  }, [
      conversationState, addMessage, sellingData, buyingData, addBookForSale, addBuyRequest, 
      addNotificationManual, simulateBotTyping, setSellingData, setBuyingData, setConversationState, 
      listAvailableBooks // Added missing dependency
    ]
  );
  
  // Update refs whenever the callback functions themselves are recreated
  useEffect(() => { processInitialActionRef.current = processInitialAction; }, [processInitialAction]);
  useEffect(() => { handleUserInputRef.current = handleUserInput; }, [handleUserInput]);
  useEffect(() => { handleInitialMessageRef.current = handleInitialMessage; }, [handleInitialMessage]);

  // Initial message effect
  useEffect(() => {
    if (messages.length === 0) {
      handleInitialMessageRef.current();
    }
  }, [messages.length]); 

  // Effect to process notifications from BookContext
  useEffect(() => {
    if (notifications.length > 0) {
      notifications.forEach(async (notif) => {
        await simulateBotTyping(300);
        let messageText = notif.message;
        if (notif.type === 'match' && notif.bookDetails) {
            messageText += `\nLivre: ${notif.bookDetails.title}\nPrix Total: ${notif.totalPrice}F CFA.`;
            messageText += `\nContactez le vendeur via WhatsApp: ${notif.contactNumber}`;
            if (notif.buyerEmail) messageText += `\n(Notification également envoyée à ${notif.buyerEmail})`;
            addMessage(messageText, 'system', undefined, notif.bookDetails);
        } else { // Handles 'info', 'error', 'success', and our new admin email info
            addMessage(`ℹ️ ${messageText}`, 'system');
        }
        clearNotification(notif.id);
      });
    }
  }, [notifications, clearNotification, addMessage, simulateBotTyping]);


  return { messages, handleUserInput: handleUserInputRef.current, conversationState, isBotTyping };
};
