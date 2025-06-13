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

  const addMessage = useCallback((text: string | React.ReactNode, sender: ChatMessage['sender'], photoPreviewUrl?: string, bookForDisplay?: BookType, actionButtons?: ChatMessage['actionButtons']) => {
    setMessages(prev => [...prev, { id: generateId(), text, sender, timestamp: new Date(), photoPreviewUrl, bookForDisplay, actionButtons }]);
    if (sender === 'bot') setIsBotTyping(false);
  }, []);
  
  const simulateBotTyping = async (duration: number = 700) => {
    setIsBotTyping(true);
    await new Promise(resolve => setTimeout(resolve, duration));
    // isBotTyping will be set to false when addMessage(..., 'bot') is called
  };


  const processInitialAction = useCallback(async (action: 'sell' | 'buy' | 'browse') => {
    await simulateBotTyping();
    if (action === 'sell') {
      setConversationState('SELLING_AWAITING_PHOTO');
      setSellingData({});
      addMessage("Super ! Pour commencer, veuillez envoyer une photo de la couverture du livre.", 'bot', undefined, undefined, [
        { text: "Passer l'étape photo", onClick: () => {
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
          addMessage(`${book.title}`, 'bot', undefined, book);
        });
      } else {
        addMessage("Il n'y a aucun livre disponible pour le moment. Revenez plus tard !", 'bot');
      }
      // Reset to awaiting action after browsing
      await simulateBotTyping(300);
      setConversationState('AWAITING_ACTION');
      addMessage("Que souhaitez-vous faire d'autre ?", 'bot', undefined, undefined, [
          { text: "Vendre un livre", onClick: () => handleUserInput("vendre") },
          { text: "Acheter un livre", onClick: () => handleUserInput("acheter") },
          { text: "Voir les livres", onClick: () => handleUserInput("parcourir") },
      ]);
    }
  }, [addMessage, listAvailableBooks]);

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
  }, [addMessage, processInitialAction]);

  useEffect(() => {
    if (messages.length === 0) {
      handleInitialMessage();
    }
  }, [handleInitialMessage, messages.length]);

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
        } else {
            addMessage(`ℹ️ ${messageText}`, 'system');
        }
        clearNotification(notif.id);
      });
    }
  }, [notifications, clearNotification, addMessage]);


  const handleUserInput = useCallback(async (input: string | File, rawInputText?: string) => {
    if (typeof input !== 'string' && !(input instanceof File)) return;

    const userMessageText = typeof input === 'string' ? input : (rawInputText || "Photo envoyée");
    addMessage(userMessageText, 'user', typeof input !== 'string' ? URL.createObjectURL(input) : undefined);
    await simulateBotTyping();

    switch (conversationState) {
      case 'AWAITING_ACTION':
        const actionText = typeof input === 'string' ? input.toLowerCase() : '';
        if (actionText.includes('vendre')) processInitialAction('sell');
        else if (actionText.includes('acheter')) processInitialAction('buy');
        else if (actionText.includes('parcourir') || actionText.includes('voir') || actionText.includes('liste')) processInitialAction('browse');
        else addMessage("Je n'ai pas compris. Vous pouvez 'vendre', 'acheter' ou 'parcourir' les livres.", 'bot');
        break;

      // Selling Flow
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
        // Basic email validation
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
        // All data collected for selling
        try {
          const bookToSell = {
            title: sellingData.title!,
            classLevel: sellingData.classLevel!,
            publisher: sellingData.publisher!,
            editionYear: sellingData.editionYear!,
            sellerPrice: sellingData.sellerPrice!,
            sellerName: sellingData.sellerName!,
            sellerEmail: sellingData.sellerEmail!,
            sellerPhone: input as string, // last input is phone
            photoFile: sellingData.photoFile,
          };
          addBookForSale(bookToSell); // This will trigger a success notification via context
          addMessage(`Merci ! Votre livre "${sellingData.title}" a été mis en vente. Le prix demandé est de ${sellingData.sellerPrice}F CFA. L'acheteur verra un prix de ${sellingData.sellerPrice! + SERVICE_FEE}F CFA.`, 'bot', sellingData.photoPreviewUrl);
          
          if(sellingData.photoPreviewUrl) {
            URL.revokeObjectURL(sellingData.photoPreviewUrl); // Clean up temp URL
          }

        } catch (error) {
          console.error("Error selling book:", error);
          addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la mise en vente."});
        }
        setSellingData({});
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un autre livre", onClick: () => processInitialAction('sell') },
            { text: "Acheter un livre", onClick: () => processInitialAction('buy') },
            { text: "Voir les livres", onClick: () => processInitialAction('browse') },
        ]);
        break;

      // Buying Flow
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
                buyerPhone: input as string, // last input is phone
            };
            addBuyRequest(requestData); // This will trigger match or info notification via context.
            // The notification itself will be handled by the useEffect for notifications.
        } catch (error) {
            console.error("Error submitting buy request:", error);
            addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la soumission de votre demande."});
        }
        
        setBuyingData({});
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
            { text: "Vendre un livre", onClick: () => processInitialAction('sell') },
            { text: "Faire une autre demande d'achat", onClick: () => processInitialAction('buy') },
            { text: "Voir les livres", onClick: () => processInitialAction('browse') },
        ]);
        break;
      
      default:
        addMessage("Je suis un peu perdu. Essayons autre chose.", 'bot');
        setConversationState('AWAITING_ACTION');
        await simulateBotTyping(300);
        handleInitialMessage(); // Restart conversation flow
        break;
    }
  }, [conversationState, addMessage, sellingData, buyingData, addBookForSale, addBuyRequest, processInitialAction, addNotificationManual, handleInitialMessage]);

  return { messages, handleUserInput, conversationState, isBotTyping };
};
