import { Hono } from "hono";
import { sendBroadcast } from "../handlers/websocket.handler";

const websocketRoute = new Hono();

websocketRoute.post("/ws/broadcast", sendBroadcast);

export default websocketRoute;
