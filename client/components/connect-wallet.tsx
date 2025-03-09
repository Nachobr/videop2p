"use client"

import { useEffect, useRef, useReducer } from "react"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

interface ConnectWalletProps {
  onConnect: (address: string) => void
}

// Define action types
type ActionType =
  | { type: "SET_CONNECTING"; payload: boolean }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_ADDRESS"; payload: string }
  | { type: "SET_NETWORK"; payload: string }
  | { type: "RESET" }

// Define state interface
interface State {
  isConnecting: boolean
  isConnected: boolean
  address: string
  network: string
}

// Initial state
const initialState: State = {
  isConnecting: false,
  isConnected: false,
  address: "",
  network: "ethereum",
}

// Reducer function
function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case "SET_CONNECTING":
      return { ...state, isConnecting: action.payload }
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload }
    case "SET_ADDRESS":
      return { ...state, address: action.payload }
    case "SET_NETWORK":
      return { ...state, network: action.payload }
    case "RESET":
      return initialState
    default:
      return state
  }
}

export function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const isMounted = useRef(true)
  const accountsChangedHandler = useRef<((accounts: string[]) => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("ConnectWallet: Cleaning up")
      isMounted.current = false

      // Clean up event listeners
      if (typeof window !== "undefined" && window.ethereum && accountsChangedHandler.current) {
        try {
          window.ethereum.removeListener("accountsChanged", accountsChangedHandler.current)
        } catch (error) {
          console.error("ConnectWallet: Error removing event listener:", error)
        }
      }
    }
  }, [])

  // Check if already connected on component mount
  useEffect(() => {
    console.log("ConnectWallet: Checking for existing connection")

    const checkConnection = async () => {
      try {
        if (typeof window !== "undefined" && window.ethereum) {
          const accounts = await window.ethereum
            .request({
              method: "eth_accounts",
            })
            .catch(() => {
              console.log("ConnectWallet: eth_accounts request failed")
              return []
            })

          if (accounts && accounts.length > 0) {
            const connectedAddress = accounts[0]
            console.log("ConnectWallet: Found connected account:", connectedAddress)

            // Detect network
            let networkType = "ethereum"
            if (window.ethereum.isMetaMask) {
              networkType = "metamask"
            } else if (window.ethereum.isCoinbaseWallet) {
              networkType = "coinbase"
            } else if (window.ethereum.isWalletConnect) {
              networkType = "walletconnect"
            }

            if (isMounted.current) {
              dispatch({ type: "SET_ADDRESS", payload: connectedAddress })
              dispatch({ type: "SET_NETWORK", payload: networkType })
              dispatch({ type: "SET_CONNECTED", payload: true })
              onConnect(connectedAddress)
            }
          } else {
            console.log("ConnectWallet: No connected accounts found")
          }
        }
      } catch (error) {
        console.error("ConnectWallet: Error checking connection:", error)
      }
    }

    checkConnection()

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      console.log("ConnectWallet: Accounts changed:", accounts)

      if (!isMounted.current) return

      if (accounts.length === 0) {
        // User disconnected their wallet
        console.log("ConnectWallet: Wallet disconnected")
        dispatch({ type: "SET_CONNECTED", payload: false })
        dispatch({ type: "SET_ADDRESS", payload: "" })
      } else if (accounts[0] !== state.address) {
        // User switched accounts
        console.log("ConnectWallet: Switched to account:", accounts[0])
        dispatch({ type: "SET_ADDRESS", payload: accounts[0] })
        onConnect(accounts[0])
      }
    }

    // Store the handler in a ref so we can remove it later
    accountsChangedHandler.current = handleAccountsChanged

    if (typeof window !== "undefined" && window.ethereum) {
      try {
        window.ethereum.on("accountsChanged", handleAccountsChanged)
      } catch (error) {
        console.error("ConnectWallet: Error adding event listener:", error)
      }
    }
  }, [state.address, onConnect])

  const connectWallet = async () => {
    if (state.isConnecting) {
      console.log("ConnectWallet: Already connecting, ignoring request")
      return
    }

    console.log("ConnectWallet: Connecting wallet")
    dispatch({ type: "SET_CONNECTING", payload: true })

    try {
      // Check if MetaMask or other wallet is available
      if (typeof window !== "undefined" && window.ethereum) {
        // Request account access
        const accounts = await window.ethereum
          .request({
            method: "eth_requestAccounts",
            params: [],
          })
          .catch((error: any) => {
            console.error("ConnectWallet: User rejected connection:", error)
            return null
          })

        if (!accounts || accounts.length === 0) {
          console.log("ConnectWallet: No accounts returned")
          throw new Error("Failed to connect wallet")
        }

        const address = accounts[0]
        console.log("ConnectWallet: Connected to account:", address)

        // Detect network
        let networkType = "ethereum"
        if (window.ethereum.isMetaMask) {
          networkType = "metamask"
        } else if (window.ethereum.isCoinbaseWallet) {
          networkType = "coinbase"
        } else if (window.ethereum.isWalletConnect) {
          networkType = "walletconnect"
        }

        // Only update state if component is still mounted
        if (isMounted.current) {
          dispatch({ type: "SET_ADDRESS", payload: address })
          dispatch({ type: "SET_NETWORK", payload: networkType })
          dispatch({ type: "SET_CONNECTED", payload: true })

          // Call the onConnect callback with the wallet address
          onConnect(address)
        }
      } else {
        console.log("ConnectWallet: No ethereum provider found")
        alert("Please install MetaMask or another Web3 wallet to use this app")
      }
    } catch (error) {
      console.error("ConnectWallet: Error connecting wallet:", error)
    } finally {
      if (isMounted.current) {
        dispatch({ type: "SET_CONNECTING", payload: false })
      }
    }
  }

  // Function to get the appropriate network icon
  const getNetworkIcon = () => {
    switch (state.network) {
      case "metamask":
        return <div className="h-4 w-4 rounded-full bg-orange-500" />
      case "coinbase":
        return <div className="h-4 w-4 rounded-full bg-blue-500" />
      case "walletconnect":
        return <div className="h-4 w-4 rounded-full bg-purple-500" />
      default:
        return <Wallet className="h-4 w-4" />
    }
  }

  return state.isConnected ? (
    <Button variant="outline" className="flex items-center gap-2">
      {getNetworkIcon()}
      {state.address.substring(0, 6)}...{state.address.substring(state.address.length - 4)}
    </Button>
  ) : (
    <Button onClick={connectWallet} disabled={state.isConnecting} className="flex items-center gap-2">
      <Wallet className="h-4 w-4" />
      {state.isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  )
}

// Add type definition for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<string[]>
      on: (event: string, callback: (accounts: string[]) => void) => void
      removeListener: (event: string, callback: (accounts: string[]) => void) => void
      isMetaMask?: boolean
      isCoinbaseWallet?: boolean
      isWalletConnect?: boolean
    }
  }
}

