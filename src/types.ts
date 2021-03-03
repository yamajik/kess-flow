import { Component } from "./components";
import { Graph } from "./graph";
import { MsgBus } from "./msgbus";
import * as redis from "./redis";

export namespace Network {
  export interface Options {
    msgbus?: MsgBus;
    id?: string;
    graph?: Graph;
    router?: string | null;
    nodes?: Component[];
    components?: {
      [key: string]: Component.MetaClass;
    };
    getComponent?: (options: GetComponentOptions) => Component | null;
    [key: string]: any;
  }

  export interface Context {
    msgbus: MsgBus;
    input: Input;
    output: Output;
  }

  export interface ContextOptions {
    source: {
      network: string;
      node: string;
    };
    target: {
      network: string;
      node: string;
    };
    separator?: string;
    fromKey?: string;
  }

  export interface NodeContextOptions {
    separator?: string;
    network: string;
    node: string;
  }

  export interface Input {
    hasData(port: string | MsgID, options?: HasDataOptions): Promise<boolean>;
    getData(
      port: string | MsgID,
      options?: HasDataOptions
    ): Promise<any | any[]>;
  }

  export interface Output {
    sendData(port: string | MsgID, data: any): Promise<void>;
    send(data: { [key: string]: any }): Promise<void>;
  }

  export interface EventID {
    network: string;
    node: string;
  }

  export interface MsgID extends EventID {
    port: string;
  }

  export interface HasDataOptions {
    count?: number;
  }

  export interface GetDataOptions {
    count?: number;
  }

  export interface GetComponentOptions extends Component.Options {
    type?: string;
  }
}

export namespace MsgBus {
  export type Listener = (data: MsgData) => Promise<void>;

  export type Data = MsgData | MsgData[];

  export interface MsgData {
    [key: string]: any;
  }

  export type EventData = redis.MQ.MessageData;

  export interface Options {
    client?: redis.Redis;
    mqMaxlen?: number;
    queueMaxlen?: number;
  }

  export interface HasDataOptions {
    count?: number;
  }

  export interface GetDataOptions {
    count?: number;
  }
}

export namespace Graph {
  export interface Options {
    [key: string]: any;
  }

  export interface Connection {
    src: ConnectionPort;
    tgt: ConnectionPort;
  }

  export interface ConnectionPort {
    node: string;
    port: string;
  }

  export interface Node {
    id: string;
    [key: string]: any;
  }

  export interface Patch<T> {
    added: T[];
    removed: T[];
    updated: T[];
  }

  export interface DiffResults {
    nodes: Patch<Node>;
  }
}

export namespace Component {
  export interface Options {
    id?: string;
    [key: string]: any;
  }

  export interface MetaClass {
    new (options: Options): Component;
  }
}
