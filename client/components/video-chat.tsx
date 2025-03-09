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
    case "ADD_PEER":
      const newPeers = new Map(state.peers)
      newPeers.set(action.payload.id, action.payload.stream)
      return { ...state, peers: newPeers }
    case "REMOVE_PEER":
      const newPeers = new Map(state.peers)
      newPeers.delete(action.payload)
      return { ...state, peers: newPeers }
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
  const wsRef = useRef<WebSocket | null>(null)
  const isMounted = useRef(true)

  const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "ws://localhost:8080"

  useEffect(() => {
    console.log("VideoChat: Initializing")

    let localMediaStream: MediaStream | null = null

    const initMediaAndSignaling = async () => {
      try {
        // Get local stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {
          toast.error("Media Error", { description: "Could not access camera or microphone." })
          return null
        })

        if (!stream || !isMounted.current) {
          stream?.getTracks().forEach(track => track.stop())
          return
        }

        localMediaStream = stream
        dispatch({ type: "SET_LOCAL_STREAM", payload: stream })
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.play().catch(e => console.error("Play failed:", e))
        }
        dispatch({ type: "SET_AUDIO_ENABLED", payload: stream.getAudioTracks().length > 0 })
        dispatch({ type: "SET_VIDEO_ENABLED", payload: stream.getVideoTracks().length > 0 })

        // Initialize WebSocket
        wsRef.current = new WebSocket(SIGNALING_SERVER_URL)
        const ws = wsRef.current

        ws.onopen = () => {
          console.log("WebSocket connected")
          ws.send(JSON.stringify({ type: "join", roomId, from: walletAddress }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)
          const { type, from, to, sdp, candidate } = data

          if (type === "offer" && to === walletAddress) {
            const pc = createPeerConnection(from, stream)
            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            ws.send(JSON.stringify({ type: "answer", sdp: answer, to: from, from: walletAddress, roomId }))
          } else if (type === "answer" && to === walletAddress) {
            const pc = peerConnections.current.get(from)
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          } else if (type === "candidate" && to === walletAddress) {
            const pc = peerConnections.current.get(from)
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
        }

        ws.onerror = (error) => console.error("WebSocket error:", error)
        ws.onclose = () => console.log("WebSocket closed")

        // Create offer for peers in the room
        const pc = createPeerConnection(`${walletAddress}-initiator`, stream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ws.send(JSON.stringify({ type: "offer", sdp: offer, from: walletAddress, roomId }))
      } catch (error) {
        console.error("Error initializing:", error)
        toast.error("Initialization Error", { description: "Failed to start video chat." })
      }
    }

    const createPeerConnection = (peerId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            to: peerId,
            from: walletAddress,
            roomId,
          }))
        }
      }

      pc.ontrack = (event) => {
        if (isMounted.current) {
          dispatch({ type: "ADD_PEER", payload: { id: peerId, stream: event.streams[0] } })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          dispatch({ type: "REMOVE_PEER", payload: peerId })
          peerConnections.current.delete(peerId)
        }
      }

      peerConnections.current.set(peerId, pc)
      return pc
    }

    initMediaAndSignaling()

    return () => {
      console.log("VideoChat: Cleaning up")
      isMounted.current = false
      if (localMediaStream) localMediaStream.getTracks().forEach(track => track.stop())
      peerConnections.current.forEach(pc => pc.close())
      peerConnections.current.clear()
      if (wsRef.current) wsRef.current.close()
      dispatch({ type: "RESET" })
    }
  }, [roomId, walletAddress])

  const toggleAudio = () => {
    if (!state.localStream) return
    const audioTracks = state.localStream.getAudioTracks()
    if (audioTracks.length > 0) {
      const newEnabled = !state.isAudioEnabled
      audioTracks.forEach(track => (track.enabled = newEnabled))
      dispatch({ type: "SET_AUDIO_ENABLED", payload: newEnabled })
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
    if (state.localStream) state.localStream.getTracks().forEach(track => track.stop())
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()
    if (wsRef.current) wsRef.current.close()
    dispatch({ type: "RESET" })
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
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={(el) => el && (el.srcObject = stream)}
              />
              <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                Peer ({peerId.substring(0, 8)})
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center flex-wrap gap-2 p-2 sm:p-4 bg-muted rounded-lg">
        <Button variant={state.isAudioEnabled ? "default" : "destructive"} size="icon" onClick={toggleAudio} className="h-10 w-10 sm:h-12 sm:w-12" disabled={!state.localStream || state.localStream.getAudioTracks().length === 0}>
          {state.isAudioEnabled ? <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> : <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>
        <Button variant={state.isVideoEnabled ? "default" : "destructive"} size="icon" onClick={toggleVideo} className="h-10 w-10 sm:h-12 sm:w-12" disabled={!state.localStream || state.localStream.getVideoTracks().length === 0}>
          {state.isVideoEnabled ? <Video className="h-4 w-4 sm:h-5 sm:w-5" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />}
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