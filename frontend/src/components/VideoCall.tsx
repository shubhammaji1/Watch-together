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
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteUser("Remote User");
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
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteUser(null);
        remoteStreamRef.current = null;
      }
    };

    return pc;
  };

  // Get user media
  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
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

    const stream = await getUserMedia();
    if (!stream) return;

    const pc = initializePeerConnection();

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Create offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const userName = localStorage.getItem("fullName") || "Guest";
      socket.emit("video-call-offer", {
        roomId,
        offer,
        from: userName,
      });

      setIsInCall(true);
    } catch (error) {
      console.error("Error creating offer:", error);
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
    if (!socket || !roomId) return;

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
      if (!isInCall) {
        const stream = await getUserMedia();
        if (!stream) return;

        const pc = initializePeerConnection();

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const userName = localStorage.getItem("fullName") || "Guest";
        socket.emit("video-call-answer", {
          roomId,
          answer,
          to: data.from,
          from: userName,
        });

        setIsInCall(true);
        setRemoteUser(data.from);
      }
    };

    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit; from?: string }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        if (data.from) {
          setRemoteUser(data.from);
        }
      }
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    };

    const handleCallEnd = () => {
      setRemoteUser(null);
      remoteStreamRef.current = null;
      if (isInCall) {
        setIsInCall(false);
        // Clean up peer connection
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    };

    socket.on("video-call-offer", handleOffer);
    socket.on("video-call-answer", handleAnswer);
    socket.on("video-call-ice-candidate", handleIceCandidate);
    socket.on("video-call-end", handleCallEnd);

    return () => {
      if (socket) {
        socket.off("video-call-offer", handleOffer);
        socket.off("video-call-answer", handleAnswer);
        socket.off("video-call-ice-candidate", handleIceCandidate);
        socket.off("video-call-end", handleCallEnd);
      }
    };
  }, [socket, roomId]);

  // Attach local stream when video element becomes available
  useEffect(() => {
    if (isInCall && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isInCall]);

  // Attach remote stream when video element becomes available
  useEffect(() => {
    if (remoteUser && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [remoteUser]);

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
          {isInCall ? "In call" : "Start a video call with room members"}
        </p>
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

