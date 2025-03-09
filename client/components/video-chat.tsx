"use client"

import { useEffect, useRef, useReducer } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Mic, MicOff, Monitor, Phone, Video, VideoOff, X } from "lucide-react"
import { toast } from "@/components/ui/toast"

interface VideoChatProps {
  roomId: string
  walletAddress: string
  onLeave: () => void
}

// Define action types for our reducer
type ActionType =
  | { type: "SET_LOCAL_STREAM"; payload: MediaStream | null }
  | { type: "SET_AUDIO_ENABLED"; payload: boolean }
  | { type: "SET_VIDEO_ENABLED"; payload: boolean }
  | { type: "ADD_PEER"; payload: { id: string; stream: MediaStream } }
  | { type: "REMOVE_PEER"; payload: string }
  | { type: "RESET" }

// Define our state interface
interface State {
  localStream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  peers: Map<string, MediaStream>
}

// Initial state
const initialState: State = {
  localStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  peers: new Map(),
}

// Reducer function for more predictable state updates
function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case "SET_LOCAL_STREAM":
      return { ...state, localStream: action.payload }
    case "SET_AUDIO_ENABLED":
      return { ...state, isAudioEnabled: action.payload }
    case "SET_VIDEO_ENABLED":
      return { ...state, isVideoEnabled: action.payload }
    case "ADD_PEER": {
      const newPeers = new Map(state.peers)
      newPeers.set(action.payload.id, action.payload.stream)
      return { ...state, peers: newPeers }
    }
    case "REMOVE_PEER": {
      const newPeers = new Map(state.peers)
      newPeers.delete(action.payload)
      return { ...state, peers: newPeers }
    }
    case "RESET":
      return initialState
    default:
      return state
  }
}

export function VideoChat({ roomId, walletAddress, onLeave }: VideoChatProps) {

  const [state, dispatch] = useReducer(reducer, initialState)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const isMounted = useRef(true)

  // Initialize media stream
  useEffect(() => {
    console.log("VideoChat: Initializing media stream")

    let localMediaStream: MediaStream | null = null

    const initMedia = async () => {
      try {
        // Try to get user media with both audio and video
        const stream = await navigator.mediaDevices
          .getUserMedia({
            audio: true,
            video: true,
          })
          .catch(async () => {
            console.log("VideoChat: Failed to get video+audio, trying audio only")
            // If that fails, try audio only
            return await navigator.mediaDevices
              .getUserMedia({
                audio: true,
              })
              .catch(() => {
                console.log("VideoChat: Failed to get audio only")
                toast.error("Media Error", {
                  description: "Could not access your camera or microphone."
                })
                return null
              })
          })

        if (!stream || !isMounted.current) {
          if (stream) stream.getTracks().forEach((track) => track.stop())
          return
        }

        localMediaStream = stream
        console.log("VideoChat: Got media stream:", stream.id)

        // Update state with the new stream
        dispatch({ type: "SET_LOCAL_STREAM", payload: stream })

        // Set initial audio/video state
        dispatch({
          type: "SET_AUDIO_ENABLED",
          payload: stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled,
        })
        dispatch({
          type: "SET_VIDEO_ENABLED",
          payload: stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled,
        })

        // Set video element source
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Create a demo peer for testing
        setTimeout(() => {
          if (isMounted.current) {
            console.log("VideoChat: Adding demo peer")
            dispatch({
              type: "ADD_PEER",
              payload: { id: "demo-peer-1", stream },
            })
          }
        }, 2000)
      } catch (error) {
        // Line 141-145: Update error toast
        console.error("VideoChat: Error initializing media:", error)
        toast.error("Media Error", {
          description: "Failed to initialize media. Please try again."
        })

        // Line 195-199: Update no audio toast
        toast.error("No Audio", {
          description: "No audio track available."
        })

        // Line 219-223: Update no video toast
        toast.error("No Video", {
          description: "No video track available."
        })

        // Line 232-236: Update screen sharing toast
        toast.error("Screen Sharing Unavailable", {
          description: "Screen sharing is not available in this environment."
        })

        // Line 252-255: Update room ID copied toast
        toast.success("Room ID Copied", {
          description: "Share this with others to invite them."
        })

        // Line 258-262: Update copy failed toast
        toast.error("Copy Failed", {
          description: `Please copy manually: ${roomId}`
        })
      }
    }

    initMedia()

    // Cleanup function
    return () => {
      console.log("VideoChat: Cleaning up")
      isMounted.current = false

      // Stop all tracks in the local stream
      if (localMediaStream) {
        localMediaStream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (e) {
            console.error("VideoChat: Error stopping track:", e)
          }
        })
      }

      // Close all peer connections
      peerConnections.current.forEach((pc) => {
        try {
          pc.close()
        } catch (e) {
          console.error("VideoChat: Error closing peer connection:", e)
        }
      })
      peerConnections.current.clear()

      // Reset state
      dispatch({ type: "RESET" })
    }
  }, [toast])

  // Toggle audio
  const toggleAudio = () => {
    if (!state.localStream) return

    try {
      const audioTracks = state.localStream.getAudioTracks()
      if (audioTracks.length > 0) {
        const newEnabled = !state.isAudioEnabled
        audioTracks.forEach((track) => {
          track.enabled = newEnabled
        })
        dispatch({ type: "SET_AUDIO_ENABLED", payload: newEnabled })
      } else {
        toast.error("No Video", {
          description: "No video track available."
        })
      }
    } catch (error) {
      console.error("VideoChat: Error toggling audio:", error)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (!state.localStream) return

    try {
      const videoTracks = state.localStream.getVideoTracks()
      if (videoTracks.length > 0) {
        const newEnabled = !state.isVideoEnabled
        videoTracks.forEach((track) => {
          track.enabled = newEnabled
        })
        dispatch({ type: "SET_VIDEO_ENABLED", payload: newEnabled })
      } else {
        toast.error("Screen Sharing Unavailable", {
          description: "Screen sharing is not available in this environment."
        })
      }
    } catch (error) {
      console.error("VideoChat: Error toggling video:", error)
    }
  }

  // Screen sharing (disabled)
  const toggleScreenShare = () => {
    toast.error("Screen Sharing Unavailable", {
      description: "Screen sharing is not available in this environment."
    })
  }

  // Copy room ID
  const copyRoomId = () => {
    if (!navigator.clipboard) {
      toast.error("Copy Failed", {
        description: `Please copy manually: ${roomId}`,

      })
      return
    }

    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        toast.success("Room ID Copied", {
          description: "Share this with others to invite them."
        })
      })
      .catch(() => {
        toast.error("Copy Failed", {
          description: `Please copy manually: ${roomId}`
        })
      })
  }

  // Leave room
  const leaveRoom = () => {
    console.log("VideoChat: Leaving room")

    try {
      // Stop all tracks in the local stream
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (e) {
            console.error("VideoChat: Error stopping track:", e)
          }
        })
      }

      // Close all peer connections
      peerConnections.current.forEach((pc) => {
        try {
          pc.close()
        } catch (e) {
          console.error("VideoChat: Error closing peer connection:", e)
        }
      })
      peerConnections.current.clear()

      // Reset state
      dispatch({ type: "RESET" })

      // Call onLeave callback
      onLeave()
    } catch (error) {
      console.error("VideoChat: Error leaving room:", error)
      // Still try to leave
      onLeave()
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <h2 className="text-lg font-semibold truncate max-w-[200px] sm:max-w-none">Room: {roomId}</h2>
          <Button variant="outline" size="icon" onClick={copyRoomId} className="shrink-0">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="icon" onClick={leaveRoom} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={`grid gap-4 mb-4 flex-1 ${state.peers.size === 0
          ? "grid-cols-1"
          : state.peers.size === 1
            ? "grid-cols-1 sm:grid-cols-2"
            : state.peers.size <= 3
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}
      >
        <Card className="overflow-hidden bg-muted">
          <CardContent className="p-0 relative aspect-video">
            {state.localStream ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-muted-foreground">Loading camera...</p>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">You</div>
          </CardContent>
        </Card>

        {Array.from(state.peers.entries()).map(([peerId, stream]) => (
          <Card key={peerId} className="overflow-hidden bg-muted">
            <CardContent className="p-0 relative aspect-video">
              <video
                key={`${peerId}-video`}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && el.srcObject !== stream) {
                    el.srcObject = stream
                  }
                }}
              />
              <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                Peer ({peerId.substring(0, 8)})
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center flex-wrap gap-2 p-2 sm:p-4 bg-muted rounded-lg">
        <Button
          variant={state.isAudioEnabled ? "default" : "destructive"}
          size="icon"
          onClick={toggleAudio}
          className="h-10 w-10 sm:h-12 sm:w-12"
          disabled={!state.localStream || state.localStream.getAudioTracks().length === 0}
        >
          {state.isAudioEnabled ? (
            <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        <Button
          variant={state.isVideoEnabled ? "default" : "destructive"}
          size="icon"
          onClick={toggleVideo}
          className="h-10 w-10 sm:h-12 sm:w-12"
          disabled={!state.localStream || state.localStream.getVideoTracks().length === 0}
        >
          {state.isVideoEnabled ? (
            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        <Button variant="outline" size="icon" onClick={toggleScreenShare} className="h-10 w-10 sm:h-12 sm:w-12">
          <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        <Button variant="destructive" size="icon" onClick={leaveRoom} className="h-10 w-10 sm:h-12 sm:w-12">
          <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  )
}

