import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Sem forçar transports: o Socket.IO inicia por long-polling (que envia o
    // cookie de sessão e autentica) e depois faz upgrade para WebSocket.
    // Forçar "websocket" primeiro quebra a auth por cookie (o handshake WS não
    // carrega o cookie) e o socket nunca conecta no navegador.
    socket = io(API_BASE || undefined, {
      path: "/socket.io",
      withCredentials: true,
    });
  }
  return socket;
}
