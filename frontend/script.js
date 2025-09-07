// YouTube IFrame API
let player;
let isPlayerReady = false;
let isUpdatingFromRemote = false;

// WebRTC and Socket.io
let socket;
let localConnection;
let currentRoom = null;
let isConnected = false;

// DOM elements
const roomIdInput = document.getElementById('roomId');
const videoUrlInput = document.getElementById('videoUrl');
const connectBtn = document.getElementById('connectBtn');
const generateRoomBtn = document.getElementById('generateRoomBtn');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const statusDiv = document.getElementById('status');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, null);

// YouTube API ready callback
function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API ready');
}

// Generate random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Extract YouTube video ID from URL
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Update UI status
function updateStatus(message, type = 'disconnected') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

// Connect to Socket.IO server
function connectToServer() {
    socket = io("https://watch-together-1-q5nm.onrender.com", { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        console.log('Connected to signaling server');
    });

    socket.on('connect_error', (err) => {
        updateStatus('Failed to connect to signaling server', 'disconnected');
        console.error('Socket.IO error:', err.message);
    });

    socket.on('room-joined', (data) => {
        currentRoom = data.roomId;
        updateStatus(`Connected to room: ${data.roomId}`, 'connected');
        if (data.videoUrl) loadVideo(data.videoUrl);

        loadVideoBtn.disabled = false;
        connectBtn.innerHTML = '<span class="btn-text">Disconnect</span>';
        isConnected = true;

        messageInput.disabled = false;
        sendBtn.disabled = false;
    });

    socket.on('user-joined', () => addMessageToChat('System', 'A user joined the room'));
    socket.on('user-left', () => addMessageToChat('System', 'A user left the room'));

    socket.on('video-url-change', (data) => loadVideo(data.url));
    socket.on('video-state-change', (data) => syncVideoState(data.state, false));

    socket.on('chat-message', (data) => {
        addMessageToChat(data.sender || 'Guest', data.message, false, data.time);
    });

    socket.on('disconnect', () => {
        updateStatus('Disconnected from server', 'disconnected');
        isConnected = false;
        connectBtn.innerHTML = '<span class="btn-text">Connect to Room</span>';
        loadVideoBtn.disabled = true;
        messageInput.disabled = true;
        sendBtn.disabled = true;
    });
}

// Connect to room
function connectToRoom(roomId) {
    if (isConnected) {
        socket.disconnect();
        currentRoom = null;
        updateStatus('Disconnected', 'disconnected');
        connectBtn.innerHTML = '<span class="btn-text">Connect to Room</span>';
        loadVideoBtn.disabled = true;
        messageInput.disabled = true;
        sendBtn.disabled = true;
        isConnected = false;
        return;
    }

    if (!roomId.trim()) {
        updateStatus('Please enter a room ID', 'disconnected');
        return;
    }

    updateStatus('Connecting to room...', 'connecting');
    connectBtn.innerHTML = '<span class="loading"></span> Connecting...';

    if (!socket) connectToServer();

    setTimeout(() => {
        socket.emit('join-room', roomId.trim());
    }, 500);
}

// Load YouTube video
function loadVideo(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        updateStatus('Invalid YouTube URL', 'disconnected');
        return;
    }

    videoUrlInput.value = url;

    if (!player) {
        player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId,
            events: {
                'onReady': () => isPlayerReady = true,
                'onStateChange': onPlayerStateChange
            },
            playerVars: { autoplay: 0, controls: 1, rel: 0, showinfo: 0, fs: 1 }
        });
    } else {
        player.loadVideoById(videoId);
    }
}

// Player state change callback
function onPlayerStateChange(event) {
    if (!isPlayerReady || isUpdatingFromRemote) return;
    const state = {
        currentTime: player.getCurrentTime(),
        isPlaying: event.data === YT.PlayerState.PLAYING,
        playerState: event.data
    };
    if (socket && currentRoom) {
        socket.emit('video-state-change', { state });
    }
}

// Sync video state
function syncVideoState(state, fromLocal = true) {
    if (!player || !isPlayerReady) return;
    isUpdatingFromRemote = !fromLocal;

    try {
        if (Math.abs(player.getCurrentTime() - state.currentTime) > 2) {
            player.seekTo(state.currentTime, true);
        }

        if (state.isPlaying) player.playVideo();
        else player.pauseVideo();
    } catch (error) {
        console.error('Error syncing video:', error);
    }

    setTimeout(() => isUpdatingFromRemote = false, 1000);
}

// --- CHAT FUNCTIONS ---
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

    socket.emit("chat-message", { message });
    addMessageToChat("You", message, true);
    messageInput.value = "";
}

// Event listeners
connectBtn.addEventListener('click', () => connectToRoom(roomIdInput.value.trim()));
generateRoomBtn.addEventListener('click', () => roomIdInput.value = generateRoomId());
loadVideoBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
        updateStatus('Please enter a YouTube URL', 'disconnected');
        return;
    }
    loadVideo(url);
    if (socket && currentRoom) socket.emit('video-url-change', { url });
});
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    roomIdInput.value = generateRoomId();
    console.log('Watch Together app initialized');
});
window.addEventListener('beforeunload', () => { if (socket) socket.disconnect(); });
