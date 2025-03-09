"use client"

import type React from "react"

import { useCallback, useReducer } from "react"
import { ConnectWallet } from "@/components/connect-wallet"
import { VideoChat } from "@/components/video-chat"


// Define action types
type ActionType =
  | { type: "SET_WALLET_CONNECTED"; payload: boolean }
  | { type: "SET_WALLET_ADDRESS"; payload: string }
  | { type: "SET_ROOM_ID"; payload: string }
  | { type: "SET_IN_ROOM"; payload: boolean }
  | { type: "SET_CREATING_ROOM"; payload: boolean }
  | { type: "SET_JOINING_ROOM"; payload: boolean }
  | { type: "RESET" }

// Define state interface
interface State {
  walletConnected: boolean
  walletAddress: string
  roomId: string
  inRoom: boolean
  isCreatingRoom: boolean
  isJoiningRoom: boolean
}

// Initial state
const initialState: State = {
  walletConnected: false,
  walletAddress: "",
  roomId: "",
  inRoom: false,
  isCreatingRoom: false,
  isJoiningRoom: false,
}

// Reducer function
function reducer(state: State, action: ActionType): State {
  switch (action.type) {
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

  const handleWalletConnect = useCallback((address: string) => {
    console.log("Home: Wallet connected:", address)
    dispatch({ type: "SET_WALLET_CONNECTED", payload: true })
    dispatch({ type: "SET_WALLET_ADDRESS", payload: address })
  }, [])

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

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm flex">
        <h1 className="text-2xl font-bold">Web3 Video Chat</h1>
        <div className="flex items-center gap-4">
          <ConnectWallet onConnect={handleWalletConnect} />
        </div>
      </div>

      <div className="mt-16 w-full max-w-5xl">
        {!state.walletConnected ? (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Connect your wallet to start</h2>
            <p className="text-muted-foreground mb-8">
              No email or phone number required - just connect your Web3 wallet to join or create a room.
            </p>
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
          <VideoChat roomId={state.roomId} walletAddress={state.walletAddress} onLeave={handleLeaveRoom} />
        )}
      </div>
    </main>
  )
}

