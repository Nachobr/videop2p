"use client"

import { useEffect, useRef, useReducer } from "react"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

interface ConnectWalletProps {
    onConnect: (address: string) => void
    onDisconnect?: () => void
}

// Define action types
type ActionType =
    | { type: "SET_CONNECTING"; payload: boolean }
    | { type: "SET_CONNECTED"; payload: boolean }
    | { type: "SET_ADDRESS"; payload: string }
    | { type: "SET_NETWORK"; payload: string }
    | { type: "SET_DISCONNECTING"; payload: boolean }
    | { type: "SET_AUTO_CONNECT"; payload: boolean }
    | { type: "RESET" }

// Define state interface
interface State {
    isConnecting: boolean
    isConnected: boolean
    address: string
    network: string
    isDisconnecting?: boolean
    shouldAutoConnect?: boolean
}

// Initial state
const initialState: State = {
    isConnecting: false,
    isConnected: false,
    address: "",
    network: "ethereum",
    isDisconnecting: false,
    shouldAutoConnect: false // Changed to false to prevent auto-connect by default
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
        case "SET_DISCONNECTING":
            return { ...state, isDisconnecting: action.payload }
        case "SET_AUTO_CONNECT":
            return { ...state, shouldAutoConnect: action.payload }
        case "RESET":
            return { ...initialState }
        default:
            return state
    }
}

export function WalletAuth({ onConnect, onDisconnect }: ConnectWalletProps) {
    const [state, dispatch] = useReducer(reducer, initialState)
    const isMounted = useRef(true)
    const accountsChangedHandler = useRef<((accounts: string[]) => void) | null>(null)

    // Cleanup on unmount
    useEffect(() => {
        console.log("ConnectWallet: Mounting component")
        isMounted.current = true
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

    // Check if wallet is already connected
    const checkIfWalletIsConnected = async () => {
        try {
            if (typeof window === "undefined" || !window.ethereum) {
                console.log("ConnectWallet: No ethereum provider found")
                return false
            }

            const accounts = await window.ethereum.request({ method: "eth_accounts" })

            if (accounts && accounts.length > 0) {
                const address = accounts[0]
                console.log("ConnectWallet: Found connected account:", address)

                let networkType = "ethereum"
                if (window.ethereum.isMetaMask) networkType = "metamask"
                else if (window.ethereum.isCoinbaseWallet) networkType = "coinbase"
                else if (window.ethereum.isWalletConnect) networkType = "walletconnect"

                if (isMounted.current) {
                    dispatch({ type: "SET_ADDRESS", payload: address })
                    dispatch({ type: "SET_NETWORK", payload: networkType })
                    dispatch({ type: "SET_CONNECTED", payload: true })
                    onConnect(address)
                }
                return true
            }

            console.log("ConnectWallet: No authorized accounts found")
            return false
        } catch (error) {
            console.error("ConnectWallet: Error checking wallet connection:", error)
            return false
        }
    }

    // Connect wallet function
    const connectWallet = async () => {
        if (state.isConnecting) {
            console.log("ConnectWallet: Already connecting, ignoring request")
            return
        }

        console.log("ConnectWallet: Connecting wallet")
        dispatch({ type: "SET_CONNECTING", payload: true })

        try {
            if (typeof window === "undefined" || !window.ethereum) {
                alert("Please install MetaMask or another Web3 wallet to use this app")
                throw new Error("No Ethereum provider found")
            }

            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            }).catch((error: any) => {
                console.error("ConnectWallet: User rejected connection:", error)
                throw error
            })

            if (!accounts || accounts.length === 0) {
                console.log("ConnectWallet: No accounts returned")
                throw new Error("Failed to connect wallet: No accounts returned")
            }

            const address = accounts[0]
            console.log("ConnectWallet: Connected to account:", address)

            let networkType = "ethereum"
            if (window.ethereum.isMetaMask) networkType = "metamask"
            else if (window.ethereum.isCoinbaseWallet) networkType = "coinbase"
            else if (window.ethereum.isWalletConnect) networkType = "walletconnect"

            localStorage.setItem('shouldConnectWallet', 'true')

            console.log("ConnectWallet: isMounted before state update:", isMounted.current)
            if (isMounted.current) {
                dispatch({ type: "SET_ADDRESS", payload: address })
                dispatch({ type: "SET_NETWORK", payload: networkType })
                dispatch({ type: "SET_CONNECTED", payload: true })
                dispatch({ type: "SET_AUTO_CONNECT", payload: true })
                dispatch({ type: "SET_CONNECTING", payload: false })
                console.log("ConnectWallet: State updated, calling onConnect")
                onConnect(address)
            } else {
                console.warn("ConnectWallet: Component unmounted, skipping state update")
            }
        } catch (error) {
            console.error("ConnectWallet: Error connecting wallet:", error)
            console.log("Failed to connect wallet. Please try again.")
            dispatch({ type: "SET_CONNECTING", payload: false }) // Reset even if unmounted
        }
    }

    // Disconnect wallet function
    const disconnectWallet = async () => {
        try {
            dispatch({ type: "SET_DISCONNECTING", payload: true })
            console.log("WalletAuth: Starting signout")

            // Clear the state
            dispatch({ type: "RESET" })

            // Remove from local storage to prevent auto-reconnect
            localStorage.removeItem('shouldConnectWallet')

            // Notify parent component
            if (onDisconnect) {
                onDisconnect()
            }

            console.log("WalletAuth: Wallet disconnected successfully")
        } catch (error) {
            console.error("WalletAuth: Error disconnecting wallet:", error)
        } finally {
            dispatch({ type: "SET_DISCONNECTING", payload: false })
        }
    }

    // Setup event listeners for wallet
    const setupEventListeners = () => {
        if (typeof window === "undefined" || !window.ethereum) return

        const handleAccountsChanged = (accounts: string[]) => {
            console.log("ConnectWallet: Accounts changed:", accounts)

            if (!isMounted.current) return

            if (accounts.length === 0) {
                console.log("ConnectWallet: Wallet disconnected")
                dispatch({ type: "SET_CONNECTED", payload: false })
                dispatch({ type: "SET_ADDRESS", payload: "" })

                if (onDisconnect) {
                    onDisconnect()
                }
            } else if (accounts[0] !== state.address) {
                console.log("ConnectWallet: Switched to account:", accounts[0])
                dispatch({ type: "SET_ADDRESS", payload: accounts[0] })
                onConnect(accounts[0])
            }
        }

        accountsChangedHandler.current = handleAccountsChanged

        try {
            window.ethereum.on("accountsChanged", handleAccountsChanged)
        } catch (error) {
            console.error("ConnectWallet: Error adding event listener:", error)
        }
    }

    // Check connection on component mount and setup event listeners
    useEffect(() => {
        console.log("ConnectWallet: Initializing")

        const init = async () => {
            const shouldAutoConnect = localStorage.getItem('shouldConnectWallet') === 'true'

            if (shouldAutoConnect && state.shouldAutoConnect && !state.isConnecting && !state.isDisconnecting) {
                const connected = await checkIfWalletIsConnected()
                if (!connected) {
                    console.log("ConnectWallet: Auto-connecting wallet")
                    setTimeout(() => {
                        connectWallet()
                    }, 500)
                }
            } else {
                console.log("ConnectWallet: Skipping auto-connect")
            }

            setupEventListeners()
        }

        init()
    }, [])

    // Debug state changes
    useEffect(() => {
        console.log("WalletAuth: State updated:", state)
    }, [state])

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

    return (
        <div className="w-full max-w-xs">
            {state.isConnected ? (
                <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full flex items-center gap-2 truncate">
                        {getNetworkIcon()}
                        <span className="truncate">{state.address}</span>
                    </Button>
                    <Button onClick={disconnectWallet} className="w-full flex items-center gap-2">
                        Disconnect Wallet
                    </Button>
                </div>
            ) : (
                <Button onClick={connectWallet} disabled={state.isConnecting} className="w-full flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {state.isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
            )}
        </div>
    )
}

// Add type definition for window.ethereum
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>
            on: (event: string, callback: (accounts: string[]) => void) => void
            removeListener: (event: string, callback: (accounts: string[]) => void) => void
            isMetaMask?: boolean
            isCoinbaseWallet?: boolean
            isWalletConnect?: boolean
        }
    }
}