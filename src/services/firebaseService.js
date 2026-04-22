import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, signOut, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, sendPasswordResetEmail 
} from "firebase/auth";
import { 
  doc, setDoc, onSnapshot, collection, addDoc, deleteDoc 
} from "firebase/firestore";

// --- AUTH & USER ---

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const subscribeToUserDoc = (uid, callback) => {
  return onSnapshot(doc(db, "users", uid), callback);
};

export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = async (email, password, profileData) => {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  
  await setDoc(doc(db, "users", res.user.uid), {
    profile: profileData,
    settings: { notifications: true, breakDuration: 15 },
    shifts: [],
    activeShift: null,
    workTimeAccumulated: 0,
    isBreakActive: false,
    breakStartTime: null
  });
  
  return res;
};

export const resetPassword = async (email) => {
  return await sendPasswordResetEmail(auth, email);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const saveUserData = async (updates) => {
  if (auth.currentUser) {
    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), updates, { merge: true });
    } catch (error) {
      console.error("Error guardando:", error);
    }
  }
};

// --- NOTICIAS ---

export const subscribeToNews = (callback) => {
  return onSnapshot(collection(db, "noticias"), (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    arr.sort((a, b) => b.createdAt - a.createdAt);
    callback(arr);
  });
};

export const addNews = async (newsData) => {
  return await addDoc(collection(db, "noticias"), newsData);
};

export const deleteNews = async (id) => {
  return await deleteDoc(doc(db, "noticias", id));
};

// --- LICENCIAS ---

export const subscribeToLicencias = (callback) => {
  return onSnapshot(collection(db, "licencias"), (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    arr.sort((a, b) => a.order - b.order);
    callback(arr);
  });
};

export const addLicencia = async (licenciaData) => {
  return await addDoc(collection(db, "licencias"), licenciaData);
};

export const updateLicencia = async (id, data) => {
  return await setDoc(doc(db, "licencias", id), data, { merge: true });
};

export const deleteLicencia = async (id) => {
  return await deleteDoc(doc(db, "licencias", id));
};
