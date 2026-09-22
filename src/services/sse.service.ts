export type ServerEvent = {
  type: string;
  payload: unknown;
};

type Subscriber = (event: ServerEvent) => void;

const subscribers = new Set<Subscriber>();

export function subscribe(subscriber: Subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function publish(event: ServerEvent) {
  for (const subscriber of subscribers) subscriber(event);
}
