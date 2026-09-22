import { expect, test } from "bun:test";
import { publish, subscribe } from "../../src/services/sse.service";

test("delivers published events to active SSE subscribers only", () => {
  const events: unknown[] = [];
  const unsubscribe = subscribe((event) => events.push(event));

  publish({ type: "notice", payload: { message: "hello" } });
  unsubscribe();
  publish({ type: "notice", payload: { message: "ignored" } });

  expect(events).toEqual([{ type: "notice", payload: { message: "hello" } }]);
});
