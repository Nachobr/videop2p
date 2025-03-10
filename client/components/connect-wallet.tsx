"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { initializeApp } from "firebase/app"
import { User } from "firebase/auth"; // Import the User type from Firebase

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export function ConnectGoogle({ onConnect }: { onConnect: (email: string) => void }) {
  const [user, setUser] = useState<User | null>(null); // Define the state type as User or null

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        setUser(user);
        onConnect(user.email);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [onConnect]);

  const connectGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (!user.email) {
        throw new Error("No email found for this user");
      }
      setUser(user);
      onConnect(user.email);
    } catch (error) {
      console.error("Error connecting with Google:", error);
    }
  };

  return (
    <div className="w-full max-w-xs">
      {user ? (
        <Button variant="outline" className="w-full flex items-center gap-2 truncate">
          <span className="truncate">{user.email}</span>
        </Button>
      ) : (
        <Button onClick={connectGoogle} className="w-full flex items-center gap-2">
          Connect with Google
        </Button>
      )}
    </div>
  );
}