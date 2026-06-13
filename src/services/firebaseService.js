import { auth, db, functions } from '../firebase';
import { httpsCallable } from "firebase/functions";
import {
  onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  deleteUser, GoogleAuthProvider, OAuthProvider, signInWithPopup
} from "firebase/auth";
import { 
  doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc,
  query, getDocs, writeBatch, orderBy, where, limit
} from "firebase/firestore";

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve/reject
 * within `ms` milliseconds, it rejects with a timeout error.
 * Prevents the app from hanging indefinitely if Firestore operations stall.
 */
const withTimeout = (promise, ms = 15000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: la operación tardó demasiado. Comprueba tu conexión.')), ms)
    ),
  ]);

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
export const subscribeToShifts = (uid, callback, onError, sinceDate) => {
  const shiftsRef = collection(db, "users", uid, "shifts");
  // Si se indica sinceDate ("YYYY-MM-DD"), solo se cargan los turnos desde esa fecha
  // en adelante (acota lecturas). Sin sinceDate, carga toda la subcolección (compatibilidad).
  const ref = sinceDate ? query(shiftsRef, where("date", ">=", sinceDate)) : shiftsRef;
  return onSnapshot(ref, (snapshot) => {
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
  return await withTimeout(signInWithEmailAndPassword(auth, email, password));
};

export const registerUser = async (email, password, profileData) => {
  const res = await withTimeout(createUserWithEmailAndPassword(auth, email, password));
  
  await withTimeout(setDoc(doc(db, "users", res.user.uid), {
    profile: {
      ...profileData,
      section: profileData.section || "Sin especificar"
    },
    settings: { notifications: true, breakDuration: 15 },
    shifts: [],
    activeShift: null,
    workTimeAccumulated: 0,
    isBreakActive: false,
    breakStartTime: null
  }));
  
  return res;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  await checkAndCreateSocialUserDoc(res.user);
  return res;
};

export const signInWithApple = async () => {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const res = await signInWithPopup(auth, provider);
  await checkAndCreateSocialUserDoc(res.user);
  return res;
};

const checkAndCreateSocialUserDoc = async (user) => {
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      profile: {
        email: user.email,
        fullName: user.displayName || 'Compañero/a',
        company: "Supercor",
        store: "Centro sin definir",
        rank: "Personal base",
        section: "Sin especificar"
      },
      settings: { notifications: true, breakDuration: 15 },
      shifts: [],
      activeShift: null,
      workTimeAccumulated: 0,
      isBreakActive: false,
      breakStartTime: null
    });
  }
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
  // Ordenado y acotado en servidor: evita descargar toda la colección (que crece sin
  // límite) y re-ordenarla en el cliente en cada cambio. Requiere que cada noticia
  // tenga `createdAt` (el alta siempre lo añade).
  const q = query(collection(db, "noticias"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// --- PETICIONES (REQUESTS) & EQUIPO ---

export const getTeamMembers = async (company, store, section) => {
  if (!company || !store || !section) return [];
  try {
    // Note: We use getDocs without complex where clauses to avoid needing custom composite indexes if possible.
    // However, basic equality queries on single fields don't need composite indexes unless combined.
    // In Firebase, chained == queries on DIFFERENT fields DO require a composite index.
    // To avoid creating indexes via CLI, we will fetch users by company and store, then filter section in JS.
    // Assuming the number of users per store is small enough.
    const q = query(
      collection(db, "users"),
      where("profile.company", "==", company),
      where("profile.store", "==", store)
    );
    const snap = await getDocs(q);
    const users = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (data.profile?.section === section) {
        users.push({ uid: doc.id, ...data.profile });
      }
    });
    return users.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    console.error("Error fetching team members:", error);
    return [];
  }
};

export const checkRankAvailability = async (company, store, section, newRank, userUid) => {
  // Solo aplicamos el limite si el nuevo rango es de tipo Responsable
  const isBossRank = (rank) => rank && rank.match(/.*(jefe|segundo|gestor|coordinador).*/i);
  
  if (!isBossRank(newRank)) return true; // Si es personal base, siempre permitido

  const members = await getTeamMembers(company, store, section);
  
  // Contamos cuántos responsables hay (excluyendo al propio usuario si ya era responsable)
  let bossCount = 0;
  for (const m of members) {
    if (m.uid !== userUid && isBossRank(m.rank)) {
      bossCount++;
    }
  }

  if (bossCount >= 3) {
    throw new Error("Límite alcanzado: Ya hay 3 responsables asignados en esta tienda y sección.");
  }
  
  return true;
};

export const addRequest = async (requestData) => {
  return await addDoc(collection(db, "requests"), {
    ...requestData,
    createdAt: Date.now()
  });
};

export const updateRequestStatus = async (id, newStatus) => {
  return await setDoc(doc(db, "requests", id), { status: newStatus, updatedAt: Date.now() }, { merge: true });
};

export const subscribeToMyRequests = (uid, callback) => {
  const q = query(collection(db, "requests"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(arr);
  });
};

export const subscribeToTeamRequests = (storeKey, callback) => {
  // storeKey format: "Company_Store_Section" to avoid composite index limits
  const q = query(collection(db, "requests"), where("storeKey", "==", storeKey), where("status", "==", "pending"));
  return onSnapshot(q, (snapshot) => {
    const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(arr);
  });
};

// --- ARENA / COMPETICIÓN ---

/** Envía una puntuación al backend (valida intentos y aplica tope de cordura). */
export const submitArenaScore = async (gameId, score) => {
  const fn = httpsCallable(functions, 'submitArenaScore');
  const res = await fn({ gameId, score });
  return res.data; // { success, best, improved, attemptsLeft }
};

/** Ranking de jugadores del día (orderBy score, sin índice compuesto: subcolección por fecha). */
export const subscribeToDailyScores = (dateStr, callback) => {
  const q = query(collection(db, "leaderboards", dateStr, "players"), orderBy("score", "desc"), limit(20));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => callback([]));
};

/** Ranking de tiendas del día (suma de mejores marcas). */
export const subscribeToStoreScores = (dateStr, callback) => {
  const q = query(collection(db, "leaderboards", dateStr, "stores"), orderBy("total", "desc"), limit(10));
  return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => callback([]));
};

/** Partidas puntuables ya usadas hoy (para mostrar intentos restantes). */
export const getArenaUsage = async (uid, dateStr) => {
  if (!uid) return 0;
  try {
    const snap = await getDoc(doc(db, "users", uid, "usage", `arena_${dateStr}`));
    return snap.exists() ? (snap.data().count || 0) : 0;
  } catch {
    return 0;
  }
};
