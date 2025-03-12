"use client"

import { useEffect, useRef, useReducer, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Mic, MicOff, Monitor, Phone, Video, VideoOff, X } from "lucide-react"
import { toast } from "@/components/ui/toast"

const checkMediaDevicesSupport = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

const isMobileBrowser = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};


interface VideoChatProps {
  roomId: string
  userIdentifier: string
  authMethod: "username" | "google" | "wallet"
  onLeave: () => void
}

type ActionType =
  | { type: "SET_LOCAL_STREAM"; payload: MediaStream | null }
  | { type: "SET_AUDIO_ENABLED"; payload: boolean }
  | { type: "SET_VIDEO_ENABLED"; payload: boolean }
  | { type: "ADD_PEER"; payload: { id: string; stream: MediaStream } }
  | { type: "REMOVE_PEER"; payload: string }
  | { type: "RESET" }

interface State {
  localStream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  peers: Map<string, MediaStream>
}

const initialState: State = {
  localStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  peers: new Map(),
}

function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case "SET_LOCAL_STREAM":
      return { ...state, localStream: action.payload }
    case "SET_AUDIO_ENABLED":
      return { ...state, isAudioEnabled: action.payload }
    case "SET_VIDEO_ENABLED":
      return { ...state, isVideoEnabled: action.payload }
    case "ADD_PEER": {
      const peersCopy = new Map(state.peers)
      peersCopy.set(action.payload.id, action.payload.stream)
      return { ...state, peers: peersCopy }
    }
    case "REMOVE_PEER": {
      const peersCopy = new Map(state.peers)
      peersCopy.delete(action.payload)
      return { ...state, peers: peersCopy }
    }
    case "RESET":
      return initialState
    default:
      return state
  }
}

export function VideoChat({ roomId, userIdentifier, authMethod, onLeave }: VideoChatProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)
  const peerVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map())
  const localMediaStreamRef = useRef<MediaStream | null>(null)
  const isInitializing = useRef(false)

  const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "wss://localhost:8080";
  console.log("VideoChat: Using SIGNALING_SERVER_URL:", SIGNALING_SERVER_URL)
  console.log("VideoChat: Auth method:", authMethod, "User identifier:", userIdentifier)

  // In initMedia function, add mobile-specific constraints
  const initMedia = useCallback(async () => {
    if (localMediaStreamRef.current || isInitializing.current) {
      console.log("VideoChat: Stream already acquired or initializing")
      return localMediaStreamRef.current
    }

    isInitializing.current = true
    try {
      console.log("VideoChat: Requesting media stream")
      const constraints = {
        audio: true,
        video: {
          facingMode: 'user', // Use front camera by default
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log("VideoChat: Got media stream:", stream.id)
      console.log("VideoChat: Audio track enabled:", stream.getAudioTracks()[0]?.enabled)
      console.log("VideoChat: Video track enabled:", stream.getVideoTracks()[0]?.enabled)
      // Force enable tracks
      stream.getAudioTracks().forEach(track => (track.enabled = true))
      stream.getVideoTracks().forEach(track => (track.enabled = true))
      localMediaStreamRef.current = stream
      dispatch({ type: "SET_LOCAL_STREAM", payload: stream })
      dispatch({ type: "SET_AUDIO_ENABLED", payload: true })
      dispatch({ type: "SET_VIDEO_ENABLED", payload: true })
      return stream
    } catch (error) {
      console.error("VideoChat: Error initializing media:", error)
      isInitializing.current = false
      toast.error("Initialization Error", { description: "Failed to start video chat. Check permissions." })
      throw error
    }
  }, [])
  // Add this function to your component
  const forceReconnect = () => {
    console.log("VideoChat: Force reconnecting")
    if (wsRef.current) {
      wsRef.current.close()
    }
    
    if (localMediaStreamRef.current) {
      setupWebSocketConnection(localMediaStreamRef.current)
    } else {
      // Try to reinitialize media if it's not available
      initMedia().then(stream => {
        if (stream) setupWebSocketConnection(stream)
      }).catch(err => console.error("VideoChat: Reconnect failed:", err))
    }
  }

  // Modify the controls section to add a reconnect button

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ 
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" }
      ],
      iceCandidatePoolSize: 10
    })
    
    stream.getTracks().forEach(track => pc.addTrack(track, stream))
  
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: "candidate",
          candidate: event.candidate,
          to: peerId,
          from: userIdentifier,
          authMethod: authMethod,
          roomId
        }))
      }
    }
  
    pc.ontrack = (event) => {
      console.log("VideoChat: Received track from peer:", peerId, event.streams[0]?.id)
      console.log("VideoChat: Track info:", event.track.kind, event.track.id, event.track.enabled)
      dispatch({ type: "ADD_PEER", payload: { id: peerId, stream: event.streams[0] } })
    }
  
    pc.onconnectionstatechange = () => {
      console.log("VideoChat: Peer connection state:", pc.connectionState)
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        dispatch({ type: "REMOVE_PEER", payload: peerId })
        peerConnections.current.delete(peerId)
        peerVideoRefs.current.delete(peerId)
      }
    }
  
    peerConnections.current.set(peerId, pc)
    return pc
  }, [userIdentifier, authMethod, roomId])

  // Fix the setupWebSocketConnection function to properly handle peer connections
  const setupWebSocketConnection = useCallback((stream: MediaStream) => {
    if (wsRef.current) {
      console.log("VideoChat: Closing existing WebSocket")
      wsRef.current.close()
    }

    console.log("VideoChat: Attempting WebSocket connection to:", SIGNALING_SERVER_URL)
    wsRef.current = new WebSocket(SIGNALING_SERVER_URL)
    const ws = wsRef.current

    ws.onopen = () => {
      console.log("VideoChat: WebSocket connected")
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        from: userIdentifier,
        authMethod: authMethod
      }))
    }

    ws.onmessage = async (event) => {
      console.log("VideoChat: WebSocket message:", event.data)
      const data = JSON.parse(event.data)
      const { type, from, to, sdp, candidate, peers } = data
      console.log("VideoChat: Message type:", type, "from:", from, "to:", to)
      // Handle new user list from server
      if (type === "users" && Array.isArray(peers)) {
        console.log("VideoChat: Received users in room:", peers)
        // Initiate connections to all peers that aren't us
        peers.forEach(peerId => {
          if (peerId !== userIdentifier && !peerConnections.current.has(peerId)) {
            console.log("VideoChat: Initiating connection to peer:", peerId)
            const pc = createPeerConnection(peerId, stream)
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                ws.send(JSON.stringify({
                  type: "offer",
                  sdp: pc.localDescription,
                  to: peerId,
                  from: userIdentifier,
                  authMethod: authMethod,
                  roomId
                }))
              })
              .catch(e => console.error("VideoChat: Error creating offer for peer:", peerId, e))
          }
        })
      }
      // Handle offer from another peer
      else if (type === "offer" && to === userIdentifier) {
        console.log("VideoChat: Received offer from:", from)
        const pc = createPeerConnection(from, stream)
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        ws.send(JSON.stringify({
          type: "answer",
          sdp: answer,
          to: from,
          from: userIdentifier,
          authMethod: authMethod,
          roomId
        }))
      }
      // Handle answer to our offer
      else if (type === "answer" && to === userIdentifier) {
        console.log("VideoChat: Received answer from:", from)
        const pc = peerConnections.current.get(from)
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      }
      // Handle ICE candidate
      else if (type === "candidate" && to === userIdentifier) {
        console.log("VideoChat: Received ICE candidate from:", from)
        const pc = peerConnections.current.get(from)
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    }

    ws.onerror = (error) => console.error("VideoChat: WebSocket error:", error)
    ws.onclose = () => console.log("VideoChat: WebSocket closed")
    
    // Don't create an offer here - wait for the server to send the user list
  }, [roomId, userIdentifier, authMethod, SIGNALING_SERVER_URL, createPeerConnection])

  // Effect to initialize media
  useEffect(() => {
    console.log("VideoChat: Mounting with roomId:", roomId, "userIdentifier:", userIdentifier)
    let isActive = true

    const initialize = async () => {
      try {
        const stream = await initMedia()
        if (isActive && stream) {
          console.log("VideoChat: Media initialized, setting up WebSocket")
          setupWebSocketConnection(stream)
        }
      } catch (error) {
        console.error("VideoChat: Initialization failed:", error)
      }
    }

    initialize()

    return () => {
      console.log("VideoChat: Unmounting")
      isActive = false
    }
  }, [initMedia, setupWebSocketConnection, roomId, userIdentifier])

  // Effect to handle video playback
  useEffect(() => {
    if (state.localStream && localVideoRef.current) {
      console.log("VideoChat: Setting video source and attempting play")
      localVideoRef.current.srcObject = state.localStream
      localVideoRef.current.play().then(() => {
        console.log("VideoChat: Local video playing")
      }).catch(e => console.error("VideoChat: Local video play failed:", e))
    }
  }, [state.localStream])

  useEffect(() => {
    // Update peer video elements when peers change
    Array.from(state.peers.entries()).forEach(([peerId, stream]) => {
      const videoRef = peerVideoRefs.current.get(peerId)
      if (videoRef && videoRef.srcObject !== stream) {
        console.log("VideoChat: Setting peer video source for:", peerId)
        videoRef.srcObject = stream
        videoRef.play().catch(e => console.error("VideoChat: Peer video play failed:", e))
      }
    })
  }, [state.peers])

  const toggleAudio = () => {
    if (!state.localStream) return
    const audioTracks = state.localStream.getAudioTracks()
    if (audioTracks.length > 0) {
      const newEnabled = !state.isAudioEnabled
      audioTracks.forEach(track => (track.enabled = newEnabled))
      dispatch({ type: "SET_AUDIO_ENABLED", payload: newEnabled })
      console.log("VideoChat: Audio toggled to:", newEnabled)
    } else {
      toast.error("No Audio", { description: "No audio track available." })
    }
  }

  const toggleVideo = () => {
    if (!state.localStream) return
    const videoTracks = state.localStream.getVideoTracks()
    if (videoTracks.length > 0) {
      const newEnabled = !state.isVideoEnabled
      videoTracks.forEach(track => (track.enabled = newEnabled))
      dispatch({ type: "SET_VIDEO_ENABLED", payload: newEnabled })
      console.log("VideoChat: Video toggled to:", newEnabled)
    } else {
      toast.error("No Video", { description: "No video track available." })
    }
  }

  const toggleScreenShare = () => {
    toast.error("Screen Sharing Unavailable", { description: "Not implemented yet." })
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
      .then(() => toast.success("Room ID Copied", { description: "Share this with others." }))
      .catch(() => toast.error("Copy Failed", { description: `Copy manually: ${roomId}` }))
  }

  const leaveRoom = () => {
    console.log("VideoChat: Leaving room")
    if (localMediaStreamRef.current) {
      localMediaStreamRef.current.getTracks().forEach(track => track.stop())
      localMediaStreamRef.current = null
    }
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()
    if (wsRef.current) {
      wsRef.current.close()
    }
    dispatch({ type: "RESET" })
    isInitializing.current = false
    onLeave()
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

      <div className={`grid gap-4 mb-4 flex-1 ${state.peers.size === 0 ? "grid-cols-1" : state.peers.size === 1 ? "grid-cols-1 sm:grid-cols-2" : state.peers.size <= 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}`}>
        <Card className="overflow-hidden bg-muted">
          <CardContent className="p-0 relative aspect-video">
            {state.localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ backgroundColor: "#000" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-2 p-4 text-center">
                <p className="text-muted-foreground">
                  {!checkMediaDevicesSupport()
                    ? "Camera access not available in this browser. Please use Chrome or Safari."
                    : "Waiting for camera access..."}
                </p>
                {checkMediaDevicesSupport() && (
                  <>
                    <Button variant="outline" onClick={initMedia}>
                      Allow Camera & Microphone
                    </Button>
                    {isMobileBrowser() && (
                      <p className="text-xs text-muted-foreground mt-2">
                        If the camera doesn&apos;t work, check your browser settings to allow camera and microphone access.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">You</div>
          </CardContent>
        </Card>

        {Array.from(state.peers.keys()).map(peerId => (
          <Card key={peerId} className="overflow-hidden bg-muted">
            <CardContent className="p-0 relative aspect-video">
              <video
                ref={el => {
                  if (el) {
                    peerVideoRefs.current.set(peerId, el)
                    // If we already have a stream, set it
                    const stream = state.peers.get(peerId)
                    if (stream && el.srcObject !== stream) {
                      console.log("VideoChat: Setting peer video source for:", peerId, stream.id)
                      el.srcObject = stream
                      el.play().catch(e => console.error("VideoChat: Peer video play failed:", e))
                    }
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ backgroundColor: "#000" }}
              />
              <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                {peerId}
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
          {state.isAudioEnabled ? <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> : <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>
        <Button
          variant={state.isVideoEnabled ? "default" : "destructive"}
          size="icon"
          onClick={toggleVideo}
          className="h-10 w-10 sm:h-12 sm:w-12"
          disabled={!state.localStream || state.localStream.getVideoTracks().length === 0}
        >
          {state.isVideoEnabled ? <Video className="h-4 w-4 sm:h-5 sm:w-5" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>
        <Button variant="outline" size="icon" onClick={toggleScreenShare} className="h-10 w-10 sm:h-12 sm:w-12">
          <Monitor className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={forceReconnect} className="h-10 w-10 sm:h-12 sm:w-12" title="Reconnect">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-5 sm:w-5">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </Button>
        <Button variant="destructive" size="icon" onClick={leaveRoom} className="h-10 w-10 sm:h-12 sm:w-12">
          <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  )
}


