"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { User } from "firebase/auth"
import { auth } from "@/utils/firebaseConfig"

const provider = new GoogleAuthProvider();

export function GoogleAuth({ onConnect }: { onConnect: (email: string) => void }) {
    const [user, setUser] = useState<User | null>(null);
    const [isConnectedToApp, setIsConnectedToApp] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!isMounted) return;

            if (user && user.email && isConnectedToApp) {
                setUser(user);
                onConnect(user.email);
            } else if (!isConnectedToApp) {
                // User is authenticated with Firebase but not connected to the app
                setUser(user);
            } else {
                setUser(null);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [onConnect, isConnectedToApp]);

    const connectGoogle = async () => {
        try {
            // If user is already authenticated with Firebase, just connect to app
            if (auth.currentUser) {
                setIsConnectedToApp(true);
                if (auth.currentUser.email) {
                    onConnect(auth.currentUser.email);
                }
                return;
            }

            // Otherwise, sign in with popup
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            if (!user.email) {
                throw new Error("No email found for this user");
            }
            setIsConnectedToApp(true);
            onConnect(user.email);
        } catch (error) {
            console.error("Error connecting with Google:", error);
        }
    };

    const disconnectGoogle = async () => {
        try {
            // Just disconnect from app without signing out from Firebase
            setIsConnectedToApp(false);
            onConnect(""); // Call this explicitly to reset app state
        } catch (error) {
            console.error("Error disconnecting from Google:", error);
        }
    };

    return (
        <div className="w-full max-w-xs">
            {user && isConnectedToApp ? (
                <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full flex items-center gap-2 truncate">
                        <span className="truncate">{user.email}</span>
                    </Button>
                    <Button onClick={disconnectGoogle} className="w-full flex items-center gap-2">
                        Disconnect
                    </Button>
                    <div className="text-center mt-2">
                        <span className="text-sm text-muted-foreground">Logged in as: {user.email}</span>
                    </div>
                </div>
            ) : (
                <Button onClick={connectGoogle} className="w-full flex items-center gap-2">
                    Connect with Google
                </Button>
            )}
        </div>
    );
}