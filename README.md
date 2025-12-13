# WatchTogether

A real-time video calling and streaming application built with modern web technologies. Users can create rooms, join video calls, and communicate with peers in real-time using WebRTC and Socket.IO.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

## ✨ Features

- **User Authentication**: Secure login and authentication powered by Supabase
- **Real-time Video Calls**: WebRTC-based peer-to-peer video streaming
- **Room-based Calling**: Create and join video call rooms
- **Real-time Communication**: Socket.IO integration for signaling and event handling
- **Responsive UI**: Tailwind CSS for modern, mobile-friendly design
- **Hot Module Reloading (HMR)**: Fast development experience with Vite

## 🛠️ Tech Stack

### Frontend
- **React 19.1.1** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite 7.1** - Build tool and dev server with HMR
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **React Router DOM 7.10** - Client-side routing
- **Lucide React** - Icon library

### Backend Integration
- **Supabase** - Authentication and backend services
- **Socket.IO** - Real-time bidirectional communication
- **WebRTC** - Peer-to-peer video/audio streaming

### Development Tools
- **ESLint 9.33** - Code quality and linting
- **TypeScript ESLint** - Type-aware linting rules

## 📁 Project Structure

```
watchtogether/
├── src/
│   ├── components/           # Reusable React components
│   │   └── auth/            # Authentication components
│   ├── page/                # Page components
│   │   └── WatchTogether.tsx # Main video call page
│   ├── lib/                 # Utilities and libraries
│   ├── assets/              # Static assets
│   ├── App.tsx              # Main app component with routing
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles
│   └── App.css              # App-level styles
├── public/                  # Static files
├── dist/                    # Build output
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── eslint.config.js         # ESLint rules
└── index.html               # HTML entry point
```

## 📋 Prerequisites

- **Node.js**: v16 or higher
- **npm**: v7 or higher
- **Supabase Account**: For authentication and backend services
- **Socket.IO Server**: External Socket.IO server for real-time communication

## 💻 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd watchtogether
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SOCKET_IO_URL=your_socket_io_server_url
   ```

## 🚀 Getting Started

1. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Preview the production build**
   ```bash
   npm run preview
   ```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with HMR |
| `npm run build` | Build TypeScript and Vite for production |
| `npm run lint` | Run ESLint to check code quality |
| `npm run preview` | Preview the production build locally |

## 🏗️ Architecture

### Authentication Flow
1. User logs in via the Login component
2. Supabase handles authentication
3. Authenticated users can access the WatchTogether video call page

### Video Call Flow
1. Users join a room via Socket.IO connection
2. WebRTC offer/answer exchange happens through Socket.IO signaling
3. ICE candidates are exchanged for NAT traversal
4. Peer-to-peer video stream is established

### Real-time Communication
- **Socket.IO Events**:
  - `join-room`: User joins a video room
  - `video-call-offer`: WebRTC offer transmission
  - `video-call-answer`: WebRTC answer transmission
  - `video-call-ice-candidate`: ICE candidate exchange
  - `video-call-end`: Call termination signal

## 🔧 Troubleshooting

### Video Calls Not Working?

Check the following documentation files for detailed troubleshooting:

- **`PROBLEM_EXPLANATION.md`** - Explains what might be wrong
- **`HOW_TO_FIX.md`** - Step-by-step fix guide
- **`SERVER_SETUP.md`** - Server configuration details

### Common Issues

1. **Can't connect to server**: Verify Socket.IO server URL in `.env`
2. **Camera access denied**: Check browser permissions
3. **No remote video**: Ensure server is forwarding WebRTC signaling events
4. **CORS errors**: Configure server CORS settings for your frontend domain


## 📦 Key Dependencies

- **@supabase/supabase-js**: Authentication and Postgres database access
- **react-router-dom**: Client-side routing
- **Socket.IO Client**: Real-time communication client
- **WebRTC API**: Browser's native video/audio streaming (no package needed)

## 🎨 Styling

The project uses **Tailwind CSS** for all styling. Tailwind provides a utility-first approach with a comprehensive set of classes for rapid UI development.

## 📝 Configuration Files

- **`tsconfig.json`** - TypeScript compiler options
- **`vite.config.ts`** - Vite build and dev server configuration
- **`eslint.config.js`** - ESLint rules and configuration
- **`.env`** - Environment variables (create this file locally)

## 🤝 Contributing

When contributing to this project:
1. Run `npm run lint` to check code quality
2. Follow the existing TypeScript and React patterns
3. Ensure all components are properly typed
4. Test changes locally with `npm run dev`

## 📄 License


## 🆘 Support

For issues or questions:
1. Check the troubleshooting documentation files
2. Review browser console for error messages
3. Check server logs for Socket.IO event handling
