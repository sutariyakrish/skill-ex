import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  getAuth,
  reload
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { auth, firebaseConfig } from "./config.js";
import { createUserProfile } from "./db.js";
import { createInitials, pickPalette, unique } from "../utils/helpers.js";

const VERIFY_APP_NAME = "signup-verification-app";
let verifyAuth;

function getVerifyAuth() {
  if (verifyAuth) {
    return verifyAuth;
  }
  const app = getApps().some((entry) => entry.name === VERIFY_APP_NAME)
    ? getApp(VERIFY_APP_NAME)
    : initializeApp(firebaseConfig, VERIFY_APP_NAME);
  verifyAuth = getAuth(app);
  return verifyAuth;
}

export function getAuthErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-login-credentials": "Incorrect email or password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Network issue. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/user-not-found": "No account exists with that email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/weak-password": "Password must be at least 6 characters."
  };

  return messages[code] || "Something went wrong. Please try again.";
}

export async function login(email, password) {
  try {
    const user = await signInWithEmailAndPassword(auth, email, password);
    return user;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function signup({ name, email, password, userType, institution, location, languages }) {
  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  const palette = pickPalette(credentials.user.uid);

  await createUserProfile(credentials.user.uid, {
    uid: credentials.user.uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    userType,
    institution: userType === "Student" ? institution.trim() : "",
    location: {
      country: location.country.trim(),
      state: location.state.trim(),
      city: location.city.trim(),
      pincode: location.pincode.trim()
    },
    languages: unique(languages),
    headline: "Open to learning and collaboration",
    bio: "",
    initials: createInitials(name),
    accentColor: palette.accent,
    accentSurface: palette.surface,
    credits: 0,
    signupBonusGiven: false,
    firstListingRewardGiven: false,
    createdAt: Date.now()
  });

  return credentials.user;
}

export async function startSignupEmailVerification(email, password) {
  const localAuth = getVerifyAuth();
  if (localAuth.currentUser) {
    try {
      await deleteUser(localAuth.currentUser);
    } catch {}
  }
  const credentials = await createUserWithEmailAndPassword(localAuth, email.trim().toLowerCase(), password);
  await sendEmailVerification(credentials.user);
  return credentials.user;
}

export async function resendSignupEmailVerification() {
  const localAuth = getVerifyAuth();
  if (!localAuth.currentUser) {
    throw new Error("Verification session expired. Start signup again.");
  }
  await sendEmailVerification(localAuth.currentUser);
}

export async function checkSignupEmailVerified() {
  const localAuth = getVerifyAuth();
  if (!localAuth.currentUser) {
    return false;
  }
  await reload(localAuth.currentUser);
  return Boolean(localAuth.currentUser.emailVerified);
}

export async function finalizeVerifiedSignup({ name, email, password, userType, institution, location, languages }) {
  const credentials = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const palette = pickPalette(credentials.user.uid);
  await createUserProfile(credentials.user.uid, {
    uid: credentials.user.uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    userType,
    institution: userType === "Student" ? institution.trim() : "",
    location: {
      country: location.country.trim(),
      state: location.state.trim(),
      city: location.city.trim(),
      pincode: location.pincode.trim()
    },
    languages: unique(languages),
    headline: "Open to learning and collaboration",
    bio: "",
    initials: createInitials(name),
    accentColor: palette.accent,
    accentSurface: palette.surface,
    credits: 0,
    signupBonusGiven: false,
    firstListingRewardGiven: false,
    createdAt: Date.now()
  });
  const localAuth = getVerifyAuth();
  if (localAuth.currentUser) {
    await signOut(localAuth);
  }
  return credentials.user;
}

export async function logout() {
  await signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function syncAuthEmail(nextEmail) {
  if (auth.currentUser && auth.currentUser.email !== nextEmail) {
    await updateEmail(auth.currentUser, nextEmail);
  }
}
