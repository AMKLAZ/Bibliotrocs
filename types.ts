
// import { Book } from './types'; // Forward declaration for Book - REMOVED

export interface ChatMessage {
  id: string;
  text: string | React.ReactNode; // Can be simple text or a component (e.g., for book display)
  sender: 'user' | 'bot' | 'system';
  timestamp: Date;
  photoPreviewUrl?: string; // For user messages with photo uploads
  bookForDisplay?: Book; // For bot messages displaying a book
  actionButtons?: { text: string; onClick: () => void }[];
}

export interface Book {
  id: string;
  photoFile?: File; 
  photoPreviewUrl?: string; 
  title: string;
  classLevel: string;
  publisher: string;
  editionYear: string;
  sellerPrice: number;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  status: 'available' | 'sold';
}

export interface BuyRequest {
  id:string;
  title: string;
  classLevel: string;
  publisher: string;
  editionYear: string;
  buyerEmail: string;
  buyerPhone: string;
  status: 'pending' | 'notified' | 'fulfilled';
}

export interface AppNotification {
  id: string;
  type: 'match' | 'info' | 'error' | 'success';
  message: string;
  bookDetails?: Book;
  totalPrice?: number; 
  contactNumber?: string;
  buyerEmail?: string; 
}

export type ConversationState =
  | 'IDLE'
  | 'AWAITING_ACTION'
  // Selling states
  | 'SELLING_AWAITING_PHOTO'
  | 'SELLING_AWAITING_TITLE'
  | 'SELLING_AWAITING_CLASS_LEVEL'
  | 'SELLING_AWAITING_PUBLISHER'
  | 'SELLING_AWAITING_EDITION_YEAR'
  | 'SELLING_AWAITING_PRICE'
  | 'SELLING_AWAITING_SELLER_NAME'
  | 'SELLING_AWAITING_SELLER_EMAIL'
  | 'SELLING_AWAITING_SELLER_PHONE'
  // Buying states
  | 'BUYING_AWAITING_TITLE'
  | 'BUYING_AWAITING_CLASS_LEVEL'
  | 'BUYING_AWAITING_PUBLISHER'
  | 'BUYING_AWAITING_EDITION_YEAR'
  | 'BUYING_AWAITING_BUYER_EMAIL'
  | 'BUYING_AWAITING_BUYER_PHONE'
  // Browsing state
  | 'BROWSING_BOOKS';

export interface SellingFormData {
  photoFile?: File;
  photoPreviewUrl?: string;
  title?: string;
  classLevel?: string;
  publisher?: string;
  editionYear?: string;
  sellerPrice?: number;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string;
}

export interface BuyingFormData {
  title?: string;
  classLevel?: string;
  publisher?: string;
  editionYear?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}