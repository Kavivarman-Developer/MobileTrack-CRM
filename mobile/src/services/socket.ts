import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;
let activeToken: string | null = null;

export function connectSocket(token: string) {
  if (socket?.connected && activeToken === token) return socket;
  disconnectSocket();
  activeToken = token;
  socket = io(API_BASE_URL.replace(/\/api\/?$/, ""), {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}
