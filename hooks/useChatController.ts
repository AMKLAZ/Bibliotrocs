

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, ConversationState, SellingFormData, BuyingFormData, Book as BookType, AppNotification, ExtractedBookInfo } from '../types';
import { useBookContext } from '../context/BookContext';
import { SERVICE_FEE, WHATSAPP_CONTACT_NUMBER } from '../constants';
import { extractBookInfoFromImage, generateTextFromApi } from '../services/aiService'; 
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
        ...prev, 
        title: tempExtractedInfo.title || '',
        classLevel: tempExtractedInfo.classLevel || '',
        publisher: tempExtractedInfo.publisher || '',
        editionYear: tempExtractedInfo.editionYear || '',
      }));
      setTempExtractedInfo(null); 
      addMessage(`Parfait ! Quel est le prix que vous souhaitez pour ce livre (en F CFA) ? \nUn complément de ${SERVICE_FEE}F CFA sera ajouté comme frais de service.`, 'bot');
      setConversationState('SELLING_AWAITING_PRICE');
    } else {
      setTempExtractedInfo(null); 
      setSellingData(prev => ({ 
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
        if (typeof input === 'string') {
          const SANE_MAX_INPUT_LENGTH = 1000; // Prevent overly long inputs
          const trimmedInput = input.trim();
          
          if (trimmedInput === '') {
            addMessage("Veuillez taper une action ou une question.", 'bot');
            await simulateBotTyping(300);
            (getHandleInitialMessage())(); // Re-sends the initial greeting and buttons
            break;
          }

          const actionText = trimmedInput.toLowerCase();
          if (actionText.includes('vendre')) {
            (getProcessInitialAction())('sell');
          } else if (actionText.includes('acheter')) {
            (getProcessInitialAction())('buy');
          } else if (actionText.includes('parcourir') || actionText.includes('voir') || actionText.includes('liste')) {
            (getProcessInitialAction())('browse');
          } else { // General text query
            setIsBotTyping(true);
            const aiResponseText = await generateTextFromApi(trimmedInput.substring(0, SANE_MAX_INPUT_LENGTH));
            // setIsBotTyping(false) is handled by addMessage if sender is 'bot'

            addMessage(aiResponseText, 'bot');
            
            await simulateBotTyping(300);
            addMessage("Que souhaitez-vous faire maintenant ?", 'bot', undefined, undefined, [
              { text: "📚 Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); (getProcessInitialAction())('sell'); } },
              { text: "🛒 Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); (getProcessInitialAction())('buy'); } },
              { text: "🔍 Parcourir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); (getProcessInitialAction())('browse'); } },
            ]);
            // Remain in AWAITING_ACTION state
          }
        } else {
          // Input is not a string (e.g., a File object, though UI shouldn't allow this in AWAITING_ACTION)
          addMessage("Je n'ai pas compris votre demande. Veuillez utiliser du texte.", 'bot');
          await simulateBotTyping(300);
          (getHandleInitialMessage())(); // Re-prompt
        }
        break;

      case 'SELLING_AWAITING_PHOTO':
        if (input instanceof File) {
          addMessage("Photo reçue. Je vais essayer d'analyser l'image pour récupérer les informations du livre...", 'bot');
          setIsBotTyping(true); 
          setSellingData(prev => ({ ...prev, photoFile: input, photoPreviewUrl: photoPreviewForUserMessage }));
          try {
            const base64FullString = await fileToBase64(input);
            const base64Data = base64FullString.split(',')[1]; 
            const extractedInfo = await extractBookInfoFromImage(base64Data);

            if (extractedInfo && (extractedInfo.title || extractedInfo.publisher || extractedInfo.classLevel || extractedInfo.editionYear)) {
              setTempExtractedInfo(extractedInfo); 
              let confirmationMessage = "J'ai analysé l'image et voici ce que j'ai pu lire :\n";
              confirmationMessage += `Titre: ${extractedInfo.title || '(non détecté)'}\n`;
              confirmationMessage += `Classe: ${extractedInfo.classLevel || '(non détectée)'}\n`;
              confirmationMessage += `Maison d'édition: ${extractedInfo.publisher || '(non détectée)'}\n`;
              confirmationMessage += `Année d'édition: ${extractedInfo.editionYear || '(non détectée)'}\n`;
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
            // setIsBotTyping(false) handled by addMessage from bot
          }
        } else {
          addMessage("Veuillez télécharger une image ou cliquer sur 'Passer l'étape photo'.", 'bot');
        }
        break;
      
      case 'SELLING_AWAITING_CONFIRMATION_FROM_IMAGE':
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
        const finalSellingData = { ...sellingData, sellerPhone: input as string };
        if (!finalSellingData.title || !finalSellingData.classLevel || !finalSellingData.publisher || !finalSellingData.editionYear || !finalSellingData.sellerPrice || !finalSellingData.sellerName || !finalSellingData.sellerEmail || !finalSellingData.sellerPhone) {
            addMessage("Il semble que des informations soient manquantes. Veuillez vérifier et recommencer le processus de vente si besoin.", 'bot');
            setConversationState('AWAITING_ACTION');
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
            sellerPhone: finalSellingData.sellerPhone,
            photoFile: finalSellingData.photoFile, 
          };
          const savedBook = await addBookForSale(bookToSellPayload);
          
          addMessage(`Merci ! Votre livre "${savedBook.title}" a été mis en vente. Le prix demandé est de ${savedBook.sellerPrice}F CFA. L'acheteur verra un prix de ${savedBook.sellerPrice + SERVICE_FEE}F CFA.`, 'bot', savedBook.photoPreviewUrl); 
          
          if(sellingData.photoPreviewUrl && sellingData.photoPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(sellingData.photoPreviewUrl); 
          }

        } catch (error) {
          console.error("Error selling book:", error);
          addNotificationManual({type: 'error', message: "Une erreur s'est produite lors de la mise en vente."});
        }
        setSellingData({}); 
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
  }, [conversationState, addMessage, sellingData, buyingData, addBookForSale, addBuyRequest, addNotificationManual, listAvailableBooks, handleImageInfoConfirmation]);


  const processInitialAction = useCallback(async (action: 'sell' | 'buy' | 'browse') => {
    // await simulateBotTyping(); // simulateBotTyping is called by handleUserInput or button click handlers before this
    if (action === 'sell') {
      setConversationState('SELLING_AWAITING_PHOTO');
      setSellingData({}); 
      setTempExtractedInfo(null); 
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
      setConversationState('BROWSING_BOOKS'); // Temporarily set, then reset to AWAITING_ACTION
      const availableBooks = listAvailableBooks();
      if (availableBooks.length > 0) {
        addMessage(`Voici les livres actuellement disponibles (${availableBooks.length}) :`, 'bot');
        availableBooks.forEach(book => {
          const totalPriceForDisplay = book.sellerPrice + SERVICE_FEE;
          // Pass the original book to bookForDisplay, ChatMessage component handles adding fee for display consistency
          addMessage(`${book.title} - Prix total: ${totalPriceForDisplay}F CFA`, 'bot', undefined, book);
        });
      } else {
        addMessage("Il n'y a aucun livre disponible pour le moment. Revenez plus tard !", 'bot');
      }
      
      await simulateBotTyping(300);
      setConversationState('AWAITING_ACTION');
      addMessage("Que souhaitez-vous faire d'autre ?", 'bot', undefined, undefined, [
          { text: "📚 Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); processInitialAction('sell'); } },
          { text: "🛒 Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); processInitialAction('buy'); } },
          { text: "🔍 Parcourir les livres", onClick: () => { addMessage("Je veux voir les livres.", 'user'); processInitialAction('browse'); } },
      ]);
    }
  }, [addMessage, listAvailableBooks, simulateBotTyping]); 

  const handleInitialMessage = useCallback(async () => {
    await simulateBotTyping();
    addMessage(
      "Bonjour ! Je suis BiblioTroc, votre assistant pour l'échange et la vente de livres scolaires. Que souhaitez-vous faire aujourd'hui ?",
      'bot',
      undefined,
      undefined,
      [
        { text: "📚 Vendre un livre", onClick: () => { addMessage("Je veux vendre un livre.", 'user'); simulateBotTyping().then(()=>processInitialAction('sell')); } },
        { text: "🛒 Acheter un livre", onClick: () => { addMessage("Je veux acheter un livre.", 'user'); simulateBotTyping().then(()=>processInitialAction('buy')); } },
        { text: "🔍 Parcourir les livres", onClick: () => { addMessage("Je veux voir les livres disponibles.", 'user'); simulateBotTyping().then(()=>processInitialAction('browse')); } },
      ]
    );
    setConversationState('AWAITING_ACTION');
  }, [addMessage, processInitialAction, simulateBotTyping]);

  // Getter functions to ensure the latest versions of callbacks are used if they are called from within other callbacks
  // that might have stale closures. This is particularly relevant for the action buttons.
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
            messageText += `\nLivre: ${notif.bookDetails.title}\nPrix Total: ${notif.totalPrice}F CFA.`; 
            messageText += `\nContactez le vendeur/acheteur via WhatsApp: ${notif.contactNumber}`;
            if (notif.buyerEmail) messageText += `\n(Notification également envoyée à ${notif.buyerEmail})`;
            bookForSystemMessage = notif.bookDetails; // ChatMessage component handles display price
        } else if (notif.type === 'success' && notif.bookDetails) {
            bookForSystemMessage = notif.bookDetails;
        }
        addMessage(messageText, 'system', undefined, bookForSystemMessage); 
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