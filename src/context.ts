import { MsgBus } from "./msgbus";
import * as types from "./types";

class Node {
  options: types.Network.NodeContextOptions;

  constructor(options: types.Network.NodeContextOptions) {
    this.options = {
      separator: ".",
      ...options
    };
  }

  get network(): string {
    return this.options.network;
  }

  get node(): string {
    return this.options.node;
  }

  join(...args: string[]): string {
    return args.join(this.options.separator);
  }

  mid(port: string): types.Network.MsgID {
    return {
      network: this.options.network,
      node: this.options.node,
      port: port
    };
  }

  midString(port: string): string {
    const mid = this.mid(port);
    return this.join(mid.network, mid.node, mid.port);
  }

  eid(): types.Network.EventID {
    return {
      network: this.options.network,
      node: this.options.node
    };
  }

  eidString(): string {
    const eid = this.eid();
    return this.join(eid.network, eid.node);
  }
}

class Msg {
  msgbus: MsgBus;
  options: types.Network.ContextOptions;
  source: Node;
  target: Node;

  constructor(msgbus: MsgBus, options: types.Network.ContextOptions) {
    this.msgbus = msgbus;
    this.options = {
      separator: ".",
      fromKey: "from",
      ...options
    };
    this.source = new Node({
      separator: this.options.separator,
      ...this.options.source
    });
    this.target = new Node({
      separator: this.options.separator,
      ...this.options.target
    });
  }
}

export class Input extends Msg {
  async hasData(
    port: string | types.Network.MsgID,
    options?: types.Network.HasDataOptions
  ): Promise<boolean> {
    let mid: string;
    if (typeof port === "string") {
      mid = this.source.midString(port);
    } else {
      const node = new Node(port);
      mid = node.midString(port.port);
    }
    return await this.msgbus.hasData(mid, options);
  }

  async getData(
    port: string | types.Network.MsgID,
    options?: types.Network.GetDataOptions
  ): Promise<any | any[]> {
    let mid: string;
    if (typeof port === "string") {
      mid = this.source.midString(port);
    } else {
      const node = new Node(port);
      mid = node.midString(port.port);
    }
    return await this.msgbus.getData(mid, options);
  }
}

export class Output extends Msg {
  async sendData(port: string | types.Network.MsgID, data: any): Promise<void> {
    let mid, eid: string;
    if (typeof port === "string") {
      mid = this.target.midString(port);
      eid = this.target.eidString();
    } else {
      const node = new Node(port);
      mid = node.midString(port.port);
      eid = node.eidString();
    }
    await this.msgbus.sendData(mid, data);
    await this.msgbus.sendEvent(eid, { type: "trigger" });
  }

  async send(data: any): Promise<void> {
    await this.sendData(this.options.fromKey, {
      network: this.source.network,
      node: this.source.node,
      data
    });
  }

  async sendError(error: any): Promise<void> {
    await this.sendData(this.options.fromKey, {
      network: this.source.network,
      node: this.source.node,
      error
    });
  }
}
