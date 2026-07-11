import { firebaseAuth } from "@/lib/firebase-client";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const idToken = await firebaseAuth?.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
  // FormData bodies need the browser to set their own multipart boundary —
  // never force a Content-Type on those.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}
