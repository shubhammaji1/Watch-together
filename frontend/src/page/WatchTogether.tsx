import React, { useEffect, useState } from "react";
import "./WatchTogether.css";
import VideoCall from "../components/VideoCall";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    watchTogetherSocket: any;
    watchTogetherRoom: string | null;
    watchTogetherConnected: boolean;
  }
}

const WatchTogether: React.FC = () => {
  const [socket, setSocket] = useState<any>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Set full name from login localStorage
    const fullName = localStorage.getItem("fullName") || "Guest";
    window.localStorage.setItem("fullName", fullName);

    // Load YouTube API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    // Load Socket.IO
    const socketScript = document.createElement("script");
    socketScript.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
    document.body.appendChild(socketScript);

    // Load custom script
    const customScript = document.createElement("script");
    customScript.src = "/script.js";
    document.body.appendChild(customScript);

    // Poll for socket availability
    const checkSocket = setInterval(() => {
      if (window.watchTogetherSocket) {
        setSocket(window.watchTogetherSocket);
        setRoomId(window.watchTogetherRoom);
        setIsConnected(window.watchTogetherConnected);
        clearInterval(checkSocket);
      }
    }, 100);

    // Also listen for connection changes
    const updateConnection = () => {
      if (window.watchTogetherSocket) {
        setSocket(window.watchTogetherSocket);
        setRoomId(window.watchTogetherRoom);
        setIsConnected(window.watchTogetherConnected);
      }
    };

    const interval = setInterval(updateConnection, 500);

    return () => {
      clearInterval(checkSocket);
      clearInterval(interval);
      // Note: We don't remove scripts as they may be needed by other parts
    };
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>🎥 Watch Together</h1>
      </div>

      <div className="main-content">
        <div className="video-section">
          <div className="controls">
            <div className="input-group">
              <label htmlFor="roomId">Room ID:</label>
              <input type="text" id="roomId" placeholder="Enter or generate room ID" />
            </div>

            <div className="input-group">
              <label htmlFor="videoUrl">YouTube URL:</label>
              <input type="text" id="videoUrl" placeholder="Paste YouTube URL here" />
            </div>

            <div className="button-group">
              <button className="btn btn-primary" id="connectBtn">
                <span className="btn-text">Connect to Room</span>
              </button>
              <button className="btn btn-secondary" id="generateRoomBtn">Generate Room</button>
              <button className="btn btn-secondary" id="loadVideoBtn" disabled>
                Load Video
              </button>
            </div>

            <div className="status disconnected" id="status">
              Disconnected - Enter a room ID and click Connect
            </div>
          </div>

          <div id="player" className="video-player">
            <div>Enter a YouTube URL and connect to start watching together</div>
          </div>
        </div>

        <div className="chat-section">
          <div className="chat-header flex justify-between items-center">
            <div>
              <h3>💬 Live Chat</h3>
              <p style={{ fontSize: "14px", color: "#6c757d" }}>
                Connect to start chatting
              </p>
            </div>
            {/* Profile & Logout */}
            <div className="profile-menu">
              <span style={{ color: "#fff", fontWeight: "bold" }}>
                {localStorage.getItem("fullName") || "Guest"}
              </span>
              <button
                style={{
                  marginLeft: "10px",
                  background: "#e50914",
                  border: "none",
                  borderRadius: "5px",
                  padding: "3px 8px",
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  localStorage.removeItem("fullName");
                  window.location.href = "/login";
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="chat-messages" id="chatMessages">
            {/* Messages appear here */}
          </div>

          <div className="chat-input">
            <div className="chat-input-group">
              <input type="text" id="messageInput" placeholder="Type a message..." disabled />
              <button id="sendBtn" disabled>Send</button>
            </div>
          </div>

          {/* Video Call Section */}
          <VideoCall roomId={roomId} isConnected={isConnected} socket={socket} />
        </div>
      </div>
    </div>
  );
};

export default WatchTogether;

