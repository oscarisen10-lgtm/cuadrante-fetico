import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, signOut, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInAnonymously, deleteUser
} from "firebase/auth";
import { 
  doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc,
  query, getDocs, writeBatch, orderBy
} from "firebase/firestore";

// --- AUTH & USER ---

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const subscribeToUserDoc = (uid, callback, onError) => {
  return onSnapshot(doc(db, "users", uid), callback, onError);
};

/**
 * Subscribe to the shifts subcollection for a user.
 * Shifts are stored in users/{uid}/shifts/{shiftId} for scalability.
 */
export const subscribeToShifts = (uid, callback, onError) => {
  const shiftsRef = collection(db, "users", uid, "shifts");
  return onSnapshot(shiftsRef, (snapshot) => {
    const arr = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(arr);
  }, onError);
};

/**
 * Save a single shift to the subcollection.
 * Uses the date string as the document ID for easy upserts.
 */
export const saveShift = async (uid, shift) => {
  if (!uid || !shift.date) return;
  await setDoc(doc(db, "users", uid, "shifts", shift.date), shift, { merge: true });
};

/**
 * Save multiple shifts in a batch (max 500 per batch).
 */
export const saveShiftsBatch = async (uid, shiftsArray) => {
  if (!uid || !shiftsArray.length) return;
  const batch = writeBatch(db);
  shiftsArray.forEach(shift => {
    if (shift.date) {
      batch.set(doc(db, "users", uid, "shifts", shift.date), shift, { merge: true });
    }
  });
  await batch.commit();
};

/**
 * Delete a shift from the subcollection.
 */
export const deleteShift = async (uid, dateStr) => {
  if (!uid || !dateStr) return;
  await deleteDoc(doc(db, "users", uid, "shifts", dateStr));
};

/**
 * Delete multiple shifts in a batch.
 */
export const deleteShiftsBatch = async (uid, dateStrings) => {
  if (!uid || !dateStrings.length) return;
  const batch = writeBatch(db);
  dateStrings.forEach(dateStr => {
    batch.delete(doc(db, "users", uid, "shifts", dateStr));
  });
  await batch.commit();
};

/**
 * One-time migration: Move shifts[] array from user doc to subcollection.
 * Safe to run multiple times — it won't duplicate data.
 */
export const migrateShiftsToSubcollection = async (uid, shiftsArray) => {
  if (!uid || !shiftsArray || shiftsArray.length === 0) return;
  
  const batch = writeBatch(db);
  shiftsArray.forEach(shift => {
    if (shift.date) {
      batch.set(doc(db, "users", uid, "shifts", shift.date), {
        date: shift.date,
        type: shift.type || 'work',
        hours: shift.hours || 0,
        isHA: shift.isHA || false,
        turn: shift.turn || 'morning',
      });
    }
  });
  
  // Remove the array from the user doc
  batch.update(doc(db, "users", uid), { shifts: [] });
  
  await batch.commit();
  console.log(`Migrated ${shiftsArray.length} shifts to subcollection for user ${uid}`);
};

export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const loginAsGuest = async () => {
  const res = await signInAnonymously(auth);
  
  // Create default profile for guest if it doesn't exist
  const userDoc = await getDoc(doc(db, "users", res.user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(db, "users", res.user.uid), {
      profile: {
        email: "invitado@demo.fetico.es",
        fullName: "Tester Invitado",
        company: "Supercor",
        store: "Demo",
        rank: "Personal de fresco",
        isGuest: true
      },
      settings: { notifications: true, breakDuration: 15 },
      shifts: [],
      activeShift: null,
      workTimeAccumulated: 0,
      isBreakActive: false,
      breakStartTime: null
    });
  }
  
  return res;
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

export const deleteUserAccount = async () => {
  if (auth.currentUser) {
    const uid = auth.currentUser.uid;
    
    // Delete all shifts in subcollection first
    const shiftsSnap = await getDocs(collection(db, "users", uid, "shifts"));
    if (shiftsSnap.size > 0) {
      const batch = writeBatch(db);
      shiftsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    
    // Delete user data from Firestore
    await deleteDoc(doc(db, "users", uid));
    // Then delete the Firebase Auth account
    await deleteUser(auth.currentUser);
  }
};

export const saveUserData = async (updates) => {
  if (auth.currentUser) {
    await setDoc(doc(db, "users", auth.currentUser.uid), updates, { merge: true });
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
