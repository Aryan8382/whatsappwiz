"use client";

import { io, Socket } from "socket.io-client";
import { API_URL, getSessionUser, getToken } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = getToken();
  const user = getSessionUser();
  if (!token || !user) return null;
  if (socket && socket.connected) return socket;

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    socket?.emit("join", { organizationId: user.organizationId });
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
