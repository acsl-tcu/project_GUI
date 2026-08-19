// Minimal type declarations for roslib (no official bundled types).
declare module "roslib" {
  namespace ROSLIB {
    interface RosConstructorOptions {
      url?: string;
      [key: string]: unknown;
    }

    class Ros {
      constructor(options: RosConstructorOptions);
      on(event: "connection" | "error" | "close", callback: (arg?: unknown) => void): void;
      close(): void;
      isConnected: boolean;
    }

    interface TopicOptions {
      ros: Ros;
      name: string;
      messageType: string;
      throttle_rate?: number;
      queue_length?: number;
      queue_size?: number;
      latch?: boolean;
      compression?: string;
    }

    class Message {
      constructor(values?: Record<string, unknown>);
      [key: string]: unknown;
    }

    class Topic<TMessage = Record<string, unknown>> {
      constructor(options: TopicOptions);
      name: string;
      subscribe(callback: (message: TMessage) => void): void;
      unsubscribe(callback?: (message: TMessage) => void): void;
      advertise(): void;
      unadvertise(): void;
      publish(message: Message | TMessage): void;
    }
  }
  export = ROSLIB;
}
