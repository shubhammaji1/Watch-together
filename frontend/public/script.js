// YouTube IFrame API
let player;
let isPlayerReady = false;
let isUpdatingFromRemote = false;

// Socket.io
let socket;
let currentRoom = null;
let isConnected = false;

// Expose to window for React components
window.watchTogetherSocket = null;
window.watchTogetherRoom = null;
window.watchTogetherConnected = false;

// --- USER FULL NAME ---
let fullName = localStorage.getItem("fullName") || "Guest";

// DOM elements
const roomIdInput = document.getElementById("roomId");
const videoUrlInput = document.getElementById("videoUrl");
const connectBtn = document.getElementById("connectBtn");
const generateRoomBtn = document.getElementById("generateRoomBtn");
const loadVideoBtn = document.getElementById("loadVideoBtn");
const statusDiv = document.getElementById("status");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// --- YouTube API ---
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

function onYouTubeIframeAPIReady() {
  console.log("YouTube IFrame API ready");
}

// --- ROOM ID ---
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- VIDEO URL ---
function extractVideoId(url) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// --- STATUS ---
function updateStatus(msg, type = "disconnected") {
  statusDiv.textContent = msg;
  statusDiv.className = `status ${type}`;
}

// --- CONNECT SOCKET ---
function connectToServer() {
  socket = io("https://watch-together-1-q5nm.onrender.com", {
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("Connected to server");
    window.watchTogetherSocket = socket;
  });
  socket.on("connect_error", (err) => {
    updateStatus("Failed to connect", "disconnected");
    console.error(err);
  });

  socket.on("room-joined", (data) => {
    currentRoom = data.roomId;
    isConnected = true;
    window.watchTogetherSocket = socket;
    window.watchTogetherRoom = currentRoom;
    window.watchTogetherConnected = isConnected;

    updateStatus(`Connected to room: ${data.roomId}`, "connected");
    if (data.videoUrl) loadVideo(data.videoUrl);

    loadVideoBtn.disabled = false;
    connectBtn.innerHTML = "<span class='btn-text'>Disconnect</span>";

    messageInput.disabled = false;
    sendBtn.disabled = false;

    // Announce our presence so others know our name
    const joinMsg = JSON.stringify({ user: "System", text: `${fullName} joined the room` });
    socket.emit("chat-message", { sender: fullName, message: joinMsg });
  });

  socket.on("user-joined", (data) => {
    // Suppress default join message because it only has socket ID.
    // We rely on the custom "chat-message" announcement we send on join.
    console.log("User joined:", data);
  });
  socket.on("user-left", (data) => {
    // Show generic message instead of socket ID
    addMessageToChat("System", "A user left the room");
  });

  socket.on("video-url-change", (data) => loadVideo(data.url));
  socket.on("video-state-change", (data) => syncVideoState(data.state, false));

  // --- RECEIVE CHAT ---
  socket.on("chat-message", (data) => {
    // Filter out our own reflected messages to prevent duplicates
    if (data.sender === socket.id) return;

    let displayUser = data.sender || "Guest";
    let displayText = data.message;

    // Try to parse JSON message content to extract real user name
    try {
      const parsed = JSON.parse(data.message);
      if (parsed && parsed.user && parsed.text) {
        displayUser = parsed.user;
        displayText = parsed.text;
      }
    } catch (e) {
      // Not JSON, use as is
    }

    addMessageToChat(
      displayUser,
      displayText,
      false,
      data.time
    );
  });

  socket.on("disconnect", () => {
    updateStatus("Disconnected from server", "disconnected");
    isConnected = false;
    window.watchTogetherConnected = false;
    window.watchTogetherRoom = null;
    connectBtn.innerHTML = "<span class='btn-text'>Connect to Room</span>";
    loadVideoBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;
  });
}

// --- CONNECT TO ROOM ---
function connectToRoom(roomId) {
  if (isConnected) {
    socket.disconnect();
    currentRoom = null;
    isConnected = false;
    window.watchTogetherSocket = null;
    window.watchTogetherRoom = null;
    window.watchTogetherConnected = false;
    updateStatus("Disconnected", "disconnected");
    connectBtn.innerHTML = "<span class='btn-text'>Connect to Room</span>";
    loadVideoBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;
    return;
  }

  if (!roomId.trim()) {
    updateStatus("Please enter a room ID", "disconnected");
    return;
  }

  updateStatus("Connecting...", "connecting");
  connectBtn.innerHTML = "<span class='loading'></span> Connecting...";

  if (!socket) connectToServer();

  setTimeout(() => {
    socket.emit("join-room", roomId.trim());
  }, 500);
}

// --- LOAD VIDEO ---
function loadVideo(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return updateStatus("Invalid URL", "disconnected");

  videoUrlInput.value = url;

  if (!player) {
    player = new YT.Player("player", {
      height: "100%",
      width: "100%",
      videoId,
      events: {
        onReady: () => (isPlayerReady = true),
        onStateChange: onPlayerStateChange,
      },
      playerVars: { autoplay: 0, controls: 1, rel: 0, fs: 1 },
    });
  } else player.loadVideoById(videoId);
}

function onPlayerStateChange(event) {
  if (!isPlayerReady || isUpdatingFromRemote) return;

  const state = {
    currentTime: player.getCurrentTime(),
    isPlaying: event.data === YT.PlayerState.PLAYING,
    playerState: event.data,
  };

  if (socket && currentRoom) socket.emit("video-state-change", { state });
}

function syncVideoState(state, fromLocal = true) {
  if (!player || !isPlayerReady) return;
  isUpdatingFromRemote = !fromLocal;

  try {
    if (Math.abs(player.getCurrentTime() - state.currentTime) > 2)
      player.seekTo(state.currentTime, true);

    state.isPlaying ? player.playVideo() : player.pauseVideo();
  } catch (e) {
    console.error(e);
  }

  setTimeout(() => (isUpdatingFromRemote = false), 1000);
}

// --- CHAT ---
function addMessageToChat(username, text, isOwn = false, time = null) {
  const div = document.createElement("div");
  div.className = `message${isOwn ? " own" : ""}`;
  div.innerHTML = `
    <div class="username">${username}</div>
    <div class="text">${text}</div>
    <div class="time">${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !socket || !isConnected) return;

  // Package the message with the user name to bypass server ID overwrite
  const payload = JSON.stringify({ user: fullName, text: message });

  socket.emit("chat-message", { sender: fullName, message: payload });
  addMessageToChat(fullName, message, true);
  messageInput.value = "";
}

// --- EVENTS ---
connectBtn.addEventListener("click", () => connectToRoom(roomIdInput.value.trim()));
generateRoomBtn.addEventListener("click", () => roomIdInput.value = generateRoomId());
loadVideoBtn.addEventListener("click", () => {
  const url = videoUrlInput.value.trim();
  if (!url) return updateStatus("Please enter a YouTube URL", "disconnected");
  loadVideo(url);
  if (socket && currentRoom) socket.emit("video-url-change", { url });
});
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

document.addEventListener("DOMContentLoaded", () => {
  roomIdInput.value = generateRoomId();
  console.log("Watch Together initialized");
});

window.addEventListener("beforeunload", () => { if (socket) socket.disconnect(); });
