import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

// Loading your specific service account file
const serviceAccount = JSON.parse(
  await readFile(
    new URL('../../adherix-435ab-firebase-adminsdk-fbsvc-05e7bef25e.json', import.meta.url)
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("Firebase Admin Initialized");

export default admin;