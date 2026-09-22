import { Hono } from "hono";
import { connectEvents } from "../handlers/sse.handler";

const sseRoute = new Hono();

sseRoute.get("/events", connectEvents);

export default sseRoute;
