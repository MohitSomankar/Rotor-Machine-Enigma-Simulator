// firebase.js — Cloud connection for two-laptop message sync
// Loaded as <script type="module">, so it runs AFTER app.js (classic scripts
// execute during parsing; module scripts are deferred until parsing is done).
// It exposes window.EnigmaCloud so plain app.js can call into it.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBOauTcRQQhvXsT1BhqftwUg4P0L3XPXo",
  authDomain: "enigma-2d148.firebaseapp.com",
  projectId: "enigma-2d148",
  storageBucket: "enigma-2d148.firebasestorage.app",
  messagingSenderId: "970397084973",
  appId: "1:970397084973:web:7d19b37d0403ab0bb737a4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesRef = collection(db, "messages");

// Send one encrypted message to the shared "messages" collection.
// `pin` is the shared access code — Firestore security rules check this
// field on both read and write, so the database rejects anyone who doesn't
// know the code even though the write API itself is public.
async function sendMessage({ from, to, text, pin }) {
  await addDoc(messagesRef, {
    from,
    to,
    text,
    pin,
    // serverTimestamp() resolves to null until the server confirms the write,
    // which breaks ordering for the sender's own optimistic view — so we also
    // store a plain client timestamp and sort by that instead.
    clientTime: Date.now(),
    serverTime: serverTimestamp(),
  });
}

// Live-listen to ALL messages (both laptops share this one collection).
// Calls `callback(docsArray)` every time anything changes.
// `pin` MUST be passed and MUST be filtered with a where() clause here,
// because the Firestore security rules only allow a "list" query to succeed
// if the query itself already restricts results to matching pin — a rule
// that merely checks resource.data.pin does nothing unless the query has
// this where() too.
function subscribeToMessages(callback, pin) {
  const q = query(messagesRef, where("pin", "==", pin), orderBy("clientTime", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(docs);
    },
    (error) => {
      console.error("Firestore listen error:", error);
      window.dispatchEvent(new CustomEvent("enigma-cloud-error", { detail: error }));
    }
  );
}

// Deletes every message where `name` is either the sender or the recipient
// (scoped to the current pin, so this can't touch other groups' messages).
async function clearMyMessages(name, pin) {
  const sentQ = query(messagesRef, where("pin", "==", pin), where("from", "==", name));
  const receivedQ = query(messagesRef, where("pin", "==", pin), where("to", "==", name));
  const [sentSnap, receivedSnap] = await Promise.all([getDocs(sentQ), getDocs(receivedQ)]);

  const seen = new Set();
  const deletions = [];
  [...sentSnap.docs, ...receivedSnap.docs].forEach((d) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    deletions.push(deleteDoc(d.ref));
  });

  await Promise.all(deletions);
}

window.EnigmaCloud = { sendMessage, subscribeToMessages, clearMyMessages };
window.dispatchEvent(new CustomEvent("enigma-cloud-ready"));
