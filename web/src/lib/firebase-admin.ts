import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Paste the Firebase Admin SDK service account JSON (or its base64 encoding) into web/.env.",
    );
  }

  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const serviceAccount = JSON.parse(json);

  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

export async function verifyIdToken(idToken: string) {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return decoded;
}
