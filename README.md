# Chattr

This is a mon that contains both the backend server and the client for a real-time communication application. The application enables users to engage in real-time audio and video communication using WebRTC technology.

## Backend Server

The backend server is built with Node.js and utilizes the mediasoup library to manage media streams and handle WebRTC communication. It also uses Express for handling HTTP requests and Socket.IO for real-time bidirectional communication with the frontend clients.

### Technologies Used

- Node.js
- Express
- Socket.IO
- mediasoup

### Setup and Running

To run the backend server, follow these steps:

1. Install the dependencies:

   ```
   cd server
   npm install
   ```

2. Start the server in development mode:
   ```
   npm run dev
   ```

The server will be accessible at `http://localhost:3000`.

## Frontend Client

The frontend client is built with Svelte and uses Vite as the build tool and development server. It communicates with the backend server to manage media streams and enable real-time communication.

### Technologies Used

- Svelte
- Vite
- mediasoup-client
- Socket.IO-client

### Setup and Running

To run the frontend client, follow these steps:

1. Install the dependencies:

   ```
   cd client
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

The client will be accessible at `http://localhost:3030`.

### Real-Time Communication

When the frontend client is running, users can join a room and engage in real-time audio and video communication with other participants in the same room. The mediasoup library handles the media streams, and Socket.IO facilitates real-time communication between the client and the server.

---

Please make sure to follow the setup instructions for both the backend and the frontend to get the real-time communication application up and running. If you encounter any issues or need further assistance, feel free to refer to the respective documentation or reach out to the maintainers of this repository. Happy communicating!
