import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff } from "lucide-react";
import "./VideoCall.css";

interface VideoCallProps {
  roomId: string | null;
  isConnected: boolean;
  socket: any;
}

const VideoCall: React.FC<VideoCallProps> = ({ roomId, isConnected, socket }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isInCall, setIsInCall] = useState(false);
  const [remoteUser, setRemoteUser] = useState<string | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Initialize WebRTC
  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("📹 Received remote track:", event);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        setHasRemoteStream(true);
        setRemoteUser("Remote User");
        
        // Immediately attach remote stream to video element
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(err => {
            console.error("Error playing remote video:", err);
          });
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("video-call-ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("🔌 Peer connection state:", pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteUser(null);
        setHasRemoteStream(false);
        remoteStreamRef.current = null;
      }
    };

    return pc;
  };

  // Get user media
  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = stream;
      // Set local video immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(err => console.error("Error playing local video:", err));
      }
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Could not access camera/microphone. Please check permissions.");
      return null;
    }
  };

  // Start video call
  const startCall = async () => {
    if (!isConnected || !roomId || !socket) {
      alert("Please connect to a room first");
      return;
    }

    // If already in a call, end it first
    if (isInCall) {
      endCall();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("🚀 Starting video call...");
    const stream = await getUserMedia();
    if (!stream) return;

    setIsInCall(true); // Set this early so local video shows immediately

    const pc = initializePeerConnection();
    console.log("✅ Peer connection initialized");

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
    console.log("✅ Local stream tracks added");

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("✅ Offer created and set as local description");

      const userName = localStorage.getItem("fullName") || "Guest";
      const offerData = {
        roomId,
        offer,
        from: userName,
      };
      console.log("📤 Sending offer to room:", roomId, "from:", userName);
      console.log("📤 Offer data:", { roomId, from: userName, offerType: offer.type });
      socket.emit("video-call-offer", offerData);
      
      console.log("✅ Offer emitted - Server should broadcast this to other users in room");
    } catch (error) {
      console.error("❌ Error creating offer:", error);
      setIsInCall(false);
    }
  };

  // End video call
  const endCall = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear streams
    remoteStreamRef.current = null;

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Notify server
    if (socket && roomId) {
      socket.emit("video-call-end", { roomId });
    }

    setIsInCall(false);
    setRemoteUser(null);
    setHasRemoteStream(false);
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  // Setup socket listeners
  useEffect(() => {
    if (!socket || !roomId) {
      console.log("⚠️ VideoCall: Socket or roomId not available", { socket: !!socket, roomId });
      return;
    }

    console.log("🔌 VideoCall: Setting up socket listeners for room:", roomId);
    
    // Diagnostic: Check if socket is connected
    if (!socket.connected) {
      console.error("❌ Socket is not connected! Cannot set up video call listeners.");
      return;
    }
    
    console.log("✅ Socket is connected, setting up video call event listeners...");

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
      try {
        console.log("📥 Received offer from:", data.from);
        
        // If already in a call, close existing connection first
        if (isInCall && peerConnectionRef.current) {
          console.log("⚠️ Already in call, closing existing connection");
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        
        const stream = await getUserMedia();
        if (!stream) return;

        const pc = initializePeerConnection();
        console.log("✅ Peer connection initialized");

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
        console.log("✅ Local stream tracks added");

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log("✅ Remote description (offer) set");
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("✅ Answer created and set as local description");

        const userName = localStorage.getItem("fullName") || "Guest";
        const answerData = {
          roomId,
          answer,
          to: data.from,
          from: userName,
        };
        console.log("📤 Sending answer to:", data.from, "in room:", roomId);
        console.log("📤 Answer data:", { roomId, to: data.from, from: userName, answerType: answer.type });
        socket.emit("video-call-answer", answerData);
        console.log("✅ Answer emitted - Server should forward this to the caller");

        setIsInCall(true);
        setRemoteUser(data.from);
      } catch (error) {
        console.error("❌ Error handling offer:", error);
      }
    };

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; from?: string }) => {
      try {
        console.log("📥 Received answer from:", data.from);
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log("✅ Remote description (answer) set");
          if (data.from) {
            setRemoteUser(data.from);
          }
        }
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("✅ ICE candidate added");
        }
      } catch (error) {
        console.warn("⚠️ Non-critical error adding ICE candidate:", error);
      }
    };

    const handleCallEnd = () => {
      setRemoteUser(null);
      setHasRemoteStream(false);
      remoteStreamRef.current = null;
      setIsInCall(false);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };

    // Register all event listeners
    socket.on("video-call-offer", handleOffer);
    socket.on("video-call-answer", handleAnswer);
    socket.on("video-call-ice-candidate", handleIceCandidate);
    socket.on("video-call-end", handleCallEnd);

    // Also listen to see if server is forwarding events at all
    const onAnyHandler = (eventName: string, ...args: any[]) => {
      if (eventName.startsWith("video-call")) {
        console.log(`🔔 Socket event received: ${eventName}`, args);
      }
    };
    
    if (socket.onAny) {
      socket.onAny(onAnyHandler);
    }
    
    // Diagnostic: Test if events are being received
    setTimeout(() => {
      console.log("🔍 Diagnostic: Checking if server forwards events...");
      console.log("🔍 If you don't see '📥 Received offer from:' when another user starts a call,");
      console.log("🔍 it means your server is NOT forwarding video-call-offer events.");
      console.log("🔍 See server-example.js for the server code you need to add.");
    }, 2000);

    console.log("✅ VideoCall: Socket listeners registered");

    return () => {
      if (socket) {
        socket.off("video-call-offer", handleOffer);
        socket.off("video-call-answer", handleAnswer);
        socket.off("video-call-ice-candidate", handleIceCandidate);
        socket.off("video-call-end", handleCallEnd);
        if (socket.offAny) {
          socket.offAny(onAnyHandler);
        }
      }
    };
  }, [socket, roomId]);

  // Ensure local video plays when in call
  useEffect(() => {
    if (isInCall && localVideoRef.current && localStreamRef.current) {
      const video = localVideoRef.current;
      if (video.srcObject !== localStreamRef.current) {
        video.srcObject = localStreamRef.current;
      }
      // Force play with multiple attempts
      const playVideo = () => {
        video.play().catch(err => {
          console.warn("Local video play failed, retrying...", err);
          setTimeout(playVideo, 500);
        });
      };
      playVideo();
    }
  }, [isInCall]);

  // Ensure remote video plays when remote user connects
  useEffect(() => {
    if (hasRemoteStream && remoteVideoRef.current && remoteStreamRef.current) {
      const video = remoteVideoRef.current;
      if (video.srcObject !== remoteStreamRef.current) {
        video.srcObject = remoteStreamRef.current;
      }
      // Force play with multiple attempts
      const playVideo = () => {
        video.play().catch(err => {
          console.warn("Remote video play failed, retrying...", err);
          setTimeout(playVideo, 500);
        });
      };
      playVideo();
    }
  }, [hasRemoteStream, remoteUser]);

  // Cleanup on unmount or when roomId/socket changes
  useEffect(() => {
    return () => {
      if (isInCall) {
        endCall();
      }
    };
  }, [roomId, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return (
    <div className="video-call-section">
      <div className="video-call-header">
        <h3>📹 Video Call</h3>
        <p style={{ fontSize: "14px", color: "#6c757d" }}>
          {isInCall 
            ? (remoteUser ? `In call with ${remoteUser}` : "In call - waiting for connection...")
            : "Start a video call with room members"}
        </p>
        {!isConnected && (
          <p style={{ fontSize: "12px", color: "#ff4f4f", marginTop: "5px" }}>
            ⚠️ Not connected to room
          </p>
        )}
        {isConnected && !socket && (
          <p style={{ fontSize: "12px", color: "#ff4f4f", marginTop: "5px" }}>
            ⚠️ Socket connection not available
          </p>
        )}
      </div>

      <div className="video-call-container">
        {/* Remote video */}
        <div className="remote-video-wrapper">
          {remoteUser ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
              onLoadedMetadata={(e) => {
                e.currentTarget.play().catch(err => console.error("Error playing remote video:", err));
              }}
            />
          ) : (
            <div className="video-placeholder">
              <p>Waiting for other user...</p>
            </div>
          )}
        </div>

        {/* Local video */}
        <div className="local-video-wrapper">
          {isInCall ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
              onLoadedMetadata={(e) => {
                e.currentTarget.play().catch(err => console.error("Error playing local video:", err));
              }}
            />
          ) : (
            <div className="video-placeholder small">
              <p>Your video</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="video-call-controls">
        {!isInCall ? (
          <button
            className="video-call-btn start-call"
            onClick={startCall}
            disabled={!isConnected}
          >
            <Video size={20} />
            Start Video Call
          </button>
        ) : (
          <>
            <button
              className={`video-call-btn ${isVideoEnabled ? "active" : ""}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button
              className={`video-call-btn ${isAudioEnabled ? "active" : ""}`}
              onClick={toggleAudio}
              title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              className="video-call-btn end-call"
              onClick={endCall}
              title="End call"
            >
              <PhoneOff size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCall;

