// services/livresService.ts
import * as firebaseAppModule from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  where,
  Timestamp,
  Firestore,
  enableIndexedDbPersistence // Import for offline persistence
} from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';
import { Book, BuyRequest } from '../types';

let app: firebaseAppModule.FirebaseApp;
let db: Firestore;

// Initialize Firebase
if (!firebaseAppModule.getApps().length) {
  app = firebaseAppModule.initializeApp(firebaseConfig);
} else {
  app = firebaseAppModule.getApp();
}
db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("Firestore offline persistence enabled successfully.");
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore offline persistence failed: Multiple tabs open or other precondition not met. App will still function but may rely more on active connection.");
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence.
      console.warn("Firestore offline persistence failed: Browser does not support required features. App will need an active connection.");
    } else {
      console.error("An error occurred while enabling Firestore offline persistence: ", err);
    }
  });

const BOOKS_COLLECTION = 'books';
const BUY_REQUESTS_COLLECTION = 'buyRequests';

// Helper to convert Firestore Timestamps to Date objects
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate();
      } else if (typeof data[key] === 'object') {
        convertTimestamps(data[key]); // Recursively convert nested objects
      }
    }
  }
  return data;
};


export const addBookToFirestore = async (bookData: Omit<Book, 'id' | 'photoFile'>): Promise<Book> => {
  try {
    const docRef = await addDoc(collection(db, BOOKS_COLLECTION), bookData);
    return { ...bookData, id: docRef.id };
  } catch (error) {
    console.error("Error adding book to Firestore: ", error);
    throw error;
  }
};

export const addBuyRequestToFirestore = async (requestData: Omit<BuyRequest, 'id'>): Promise<BuyRequest> => {
  try {
    const docRef = await addDoc(collection(db, BUY_REQUESTS_COLLECTION), requestData);
    return { ...requestData, id: docRef.id };
  } catch (error) {
    console.error("Error adding buy request to Firestore: ", error);
    throw error;
  }
};

export const getBooksFromFirestore = async (): Promise<Book[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, BOOKS_COLLECTION));
    return querySnapshot.docs.map(doc => ({ ...convertTimestamps(doc.data()), id: doc.id } as Book));
  } catch (error) {
    console.error("Error fetching books from Firestore: ", error);
    throw error;
  }
};

export const getBuyRequestsFromFirestore = async (): Promise<BuyRequest[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, BUY_REQUESTS_COLLECTION));
    return querySnapshot.docs.map(doc => ({ ...convertTimestamps(doc.data()), id: doc.id } as BuyRequest));
  } catch (error) {
    console.error("Error fetching buy requests from Firestore: ", error);
    throw error;
  }
};

export const updateBuyRequestInFirestore = async (requestId: string, updates: Partial<BuyRequest>): Promise<void> => {
  try {
    const requestRef = doc(db, BUY_REQUESTS_COLLECTION, requestId);
    await updateDoc(requestRef, updates);
  } catch (error) {
    console.error("Error updating buy request in Firestore: ", error);
    throw error;
  }
};