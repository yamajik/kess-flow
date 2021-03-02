import * as IORedis from "ioredis";

export interface RedisOptions extends IORedis.RedisOptions {
  type?: string;
}

export namespace MQ {
  export interface Message {
    key: string;
    id: string;
    data: MessageData;
  }

  export interface MessageData {
    [key: string]: string | number;
  }

  export type SubscribeHandler = (data: MessageData) => Promise<any>;

  export interface Options {
    maxlen?: number;
    block?: number;
  }

  export interface Status {
    enable: boolean;
  }
}

export namespace Queue {
  export interface Options {
    maxlen?: number;
  }

  export interface HasOptions {
    count?: number;
  }

  export interface PopOptions {
    count?: number;
  }
}
