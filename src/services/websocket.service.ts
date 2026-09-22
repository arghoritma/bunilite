import type { ServerWebSocket } from "bun";

const sockets = new Set<ServerWebSocket<unknown>>();

export function addSocket(socket: ServerWebSocket<unknown>) {
  sockets.add(socket);
}

export function removeSocket(socket: ServerWebSocket<unknown>) {
  sockets.delete(socket);
}

export function broadcast(message: string) {
  for (const socket of sockets) socket.send(message);
}
