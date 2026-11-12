import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
