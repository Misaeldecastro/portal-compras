import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// O projeto prj-prd-infra-01 é compartilhado e seu Firestore (default) já
// pertence a outra aplicação. O portal vive num banco nomeado.
export const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "portal-compras";

// Sem credencial explícita: dentro do Cloud Functions o Admin SDK usa a
// identidade da própria função (ADC). O trio FIREBASE_PROJECT_ID /
// CLIENT_EMAIL / PRIVATE_KEY era exigência da Vercel, que rodava fora do GCP.
const app = getApps()[0] || initializeApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, DATABASE_ID);
