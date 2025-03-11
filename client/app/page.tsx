"use client"

import { useReducer, useCallback } from "react"
import { VideoChat } from "@/components/video-chat"
import { UsernameAuth } from "@/components/UsernameAuth"
import { GoogleAuth } from "@/components/GoogleAuth"
import { WalletAuth } from "@/components/WalletAuth"
import { Button } from "@/components/ui/button"

type ActionType =
    | { type: "SET_USERNAME_CONNECTED"; payload: boolean }
    | { type: "SET_USERNAME"; payload: string }
    | { type: "SET_WALLET_CONNECTED"; payload: boolean }
    | { type: "SET_WALLET_ADDRESS"; payload: string }
    | { type: "SET_ROOM_ID"; payload: string }
    | { type: "SET_IN_ROOM"; payload: boolean }
    | { type: "SET_CREATING_ROOM"; payload: boolean }
    | { type: "SET_JOINING_ROOM"; payload: boolean }
    | { type: "SET_AUTH_METHOD"; payload: "username" | "google" | "wallet" }
    | { type: "RESET" }

interface State {
    isAuthenticated: boolean
    //usernameConnected: boolean
    walletConnected: boolean
    walletAddress: string
    username: string
    authMethod: "username" | "google" | "wallet"
    roomId: string
    inRoom: boolean
    isCreatingRoom: boolean
    isJoiningRoom: boolean

}

const initialState: State = {
    isAuthenticated: false,
    //usernameConnected: false,
    walletConnected: false,
    walletAddress: "",
    username: "",
    authMethod: "username",
    roomId: "",
    inRoom: false,
    isCreatingRoom: false,
    isJoiningRoom: false,

}

function reducer(state: State, action: ActionType): State {
    switch (action.type) {
        case "SET_USERNAME_CONNECTED":
            return { ...state, isAuthenticated: action.payload }
        case "SET_AUTH_METHOD":
            return { ...state, authMethod: action.payload }
        case "SET_USERNAME":
            return { ...state, username: action.payload }
        case "SET_WALLET_CONNECTED":
            return { ...state, walletConnected: action.payload }
        case "SET_WALLET_ADDRESS":
            return { ...state, walletAddress: action.payload }
        case "SET_ROOM_ID":
            return { ...state, roomId: action.payload }
        case "SET_IN_ROOM":
            return { ...state, inRoom: action.payload }
        case "SET_CREATING_ROOM":
            return { ...state, isCreatingRoom: action.payload }
        case "SET_JOINING_ROOM":
            return { ...state, isJoiningRoom: action.payload }
        case "RESET":
            return initialState
        default:
            return state
    }
}

export default function Home() {
    const [state, dispatch] = useReducer(reducer, initialState)

    console.log("Home: Current state:", state)

    const handleUsernameConnect = useCallback((username: string) => {
        console.log("Home: Username connected:", username)
        dispatch({ type: "SET_USERNAME_CONNECTED", payload: true })
        dispatch({ type: "SET_USERNAME", payload: username })
        dispatch({ type: "SET_AUTH_METHOD", payload: "username" })
    }, [])

    const handleGoogleConnect = useCallback((email: string) => {
        console.log("Home: Google account connected:", email)
        dispatch({ type: "SET_USERNAME_CONNECTED", payload: true })
        dispatch({ type: "SET_USERNAME", payload: email })
        dispatch({ type: "SET_AUTH_METHOD", payload: "google" })
    }, [])

    const handleWalletConnect = useCallback((address: string) => {
        console.log("Home: Wallet connected:", address)
        dispatch({ type: "SET_WALLET_CONNECTED", payload: true })
        dispatch({ type: "SET_WALLET_ADDRESS", payload: address })
        // Also set authenticated state when wallet connects
        dispatch({ type: "SET_USERNAME_CONNECTED", payload: true })
        // Use wallet address as username if no username is set
        if (!state.username) {
            dispatch({ type: "SET_USERNAME", payload: `Wallet ${address.substring(0, 6)}...${address.substring(address.length - 4)}` })
        }
        dispatch({ type: "SET_AUTH_METHOD", payload: "wallet" })
    }, [state.username])

    const createRoom = useCallback(() => {
        if (state.isCreatingRoom) {
            console.log("Home: Already creating room, ignoring request")
            return
        }

        console.log("Home: Creating room")
        dispatch({ type: "SET_CREATING_ROOM", payload: true })

        try {
            const newRoomId = Math.random().toString(36).substring(2, 12)
            console.log("Home: Created room with ID:", newRoomId)
            dispatch({ type: "SET_ROOM_ID", payload: newRoomId })
            dispatch({ type: "SET_IN_ROOM", payload: true })
        } catch (error) {
            console.error("Home: Error creating room:", error)
        } finally {
            dispatch({ type: "SET_CREATING_ROOM", payload: false })
        }
    }, [state.isCreatingRoom])

    const joinRoom = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()

            if (state.isJoiningRoom || !state.roomId.trim()) {
                console.log("Home: Cannot join room - already joining or no room ID")
                return
            }

            console.log("Home: Joining room:", state.roomId)
            dispatch({ type: "SET_JOINING_ROOM", payload: true })

            try {
                dispatch({ type: "SET_IN_ROOM", payload: true })
            } catch (error) {
                console.error("Home: Error joining room:", error)
            } finally {
                dispatch({ type: "SET_JOINING_ROOM", payload: false })
            }
        },
        [state.isJoiningRoom, state.roomId],
    )

    const handleLeaveRoom = useCallback(() => {
        console.log("Home: Leaving room")
        dispatch({ type: "SET_IN_ROOM", payload: false })
        dispatch({ type: "SET_ROOM_ID", payload: "" })
    }, [])

    const handleDisconnect = useCallback(() => {
        console.log("Home: Disconnecting");

        // Just reset the state without signing out from Firebase
        dispatch({
            type: "RESET",

        });

        // No need to reload the page
    }, []);

    const handleWalletDisconnect = useCallback(() => {
        console.log("Home: Disconnecting wallet");

        // Only reset wallet-related state
        dispatch({ type: "SET_WALLET_CONNECTED", payload: false });
        dispatch({ type: "SET_WALLET_ADDRESS", payload: "" });

        // If no username is set, also reset authentication
        if (!state.username) {
            dispatch({ type: "SET_USERNAME_CONNECTED", payload: false });
        }
    }, [state.username]);

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
            <div className="z-10 max-w-5xl w-full items-center justify-between text-sm flex">
                <h1 className="text-2xl font-bold">VidioCol</h1>
                {state.isAuthenticated && (
                    <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                            Logged in as: {state.username}
                            {state.walletConnected && (
                                <span className="ml-2 text-xs text-green-500">
                                    (Wallet: {state.walletAddress.substring(0, 6)}...{state.walletAddress.substring(state.walletAddress.length - 4)})
                                </span>
                            )}
                        </div>
                        <Button onClick={handleDisconnect} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
                            Disconnect
                        </Button>
                    </div>
                )}
            </div>

            <div className="mt-16 w-full max-w-5xl">
                {!state.isAuthenticated ? (
                    <div className="text-center">
                        <h2 className="text-xl font-semibold mb-4">Enter a username or connect with Google to start</h2>
                        <div className="flex flex-col items-center gap-4">
                            <GoogleAuth onConnect={handleGoogleConnect} />
                            <UsernameAuth onConnect={handleUsernameConnect} />
                            <WalletAuth onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} />
                        </div>
                    </div>
                ) : !state.inRoom ? (
                    <div className="flex flex-col items-center gap-8">
                        <div className="grid gap-4 w-full max-w-md">
                            <button
                                onClick={createRoom}
                                disabled={state.isCreatingRoom}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {state.isCreatingRoom ? "Creating..." : "Create New Room"}
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Or join existing</span>
                                </div>
                            </div>

                            <form onSubmit={joinRoom} className="flex gap-2">
                                <input
                                    type="text"
                                    value={state.roomId}
                                    onChange={(e) => dispatch({ type: "SET_ROOM_ID", payload: e.target.value })}
                                    placeholder="Enter room ID"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                                    disabled={state.isJoiningRoom}
                                />
                                <button
                                    type="submit"
                                    disabled={state.isJoiningRoom || !state.roomId.trim()}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {state.isJoiningRoom ? "Joining..." : "Join"}
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <VideoChat
                        roomId={state.roomId}
                        userIdentifier={state.username}
                        authMethod={state.authMethod}
                        onLeave={handleLeaveRoom}
                    />
                )}
            </div>
        </main>
    )
}