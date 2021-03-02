import * as uuid from "uuid";
import { Component } from "./component";
import { Graph } from "./graph";
import { MsgBus } from "./msgbus";
import * as types from "./types";

export class Network {
  msgbus: MsgBus;
  options: types.Network.Options;
  nodes: Map<string, Component>;

  constructor(options?: types.Network.Options) {
    this.options = {
      id: uuid.v4(),
      router: "router",
      ...options
    };
    this.options.components = {
      default: Components.Test,
      [this.options.router]: Components.Router,
      ...this.options.components
    };
    this.msgbus = this.options.msgbus || new MsgBus();
    this.nodes = new Map<string, Component>();
    if (this.options.graph) {
      this.loadFromGraph(this.options.graph);
    }
    if (this.options.nodes) {
      this.loadNodes(this.options.nodes);
    }
  }

  static load(filename: string, options?: types.Network.Options): Network {
    return new Network({ graph: Graph.load(filename), ...options });
  }

  get id(): string {
    return this.options.id;
  }

  addComponent(c: Component): Component {
    this.nodes.set(c.id, c);
    return c;
  }

  removeComponent(c: Component): boolean {
    return this.nodes.delete(c.id);
  }

  getComponent(options: any): Component {
    const opts = {
      type: "default",
      ...options
    };

    if (this.options.getComponent) {
      return this.options.getComponent(opts);
    }

    const compnentClass = this.options.components[opts.type];
    if (!compnentClass) {
      return new Component(opts);
    }
    return new compnentClass(opts);
  }

  loadFromGraph(graph: Graph): void {
    graph.nodes.forEach(node => {
      this.addComponent(this.getComponent(node));
    });
    if (this.options.router) {
      this.addComponent(
        this.getComponent({
          type: this.options.router,
          id: this.options.router,
          graph
        })
      );
    }
  }

  loadNodes(nodes: Component[]): void {
    nodes.forEach(node => {
      this.addComponent(node);
    });
  }

  async start() {
    for (const [_, node] of this.nodes) {
      const context = this.context({
        source: { network: this.id, node: node.id },
        target: { network: this.id, node: this.options.router }
      });
      await node.setup(context);
      this.msgbus.addListener(`${this.id}.${node.id}`, async () => {
        await node.process(context);
      });
    }
  }

  async stop() {
    for (const [_, node] of this.nodes) {
      this.msgbus.removeListener(`${this.id}.${node.id}`);
      await node.teardown();
    }
  }

  context(options: types.Network.ContextOptions) {
    return {
      msgbus: this.msgbus,
      input: new Context.Input(this.msgbus, options),
      output: new Context.Output(this.msgbus, options)
    };
  }
}

export namespace Components {
  export class Test extends Component {
    async setup(ctx: types.Network.Context) {
      super.setup(ctx);
      setInterval(() => {
        ctx.output.send({ out1: "test" });
      }, 3000);
    }

    async process({ input, output }) {
      if (!(await input.hasData("in1"))) return;
      console.log(this.id, "process", { in1: await input.getData("in1") });
    }
  }

  export class Router extends Component {
    constructor(options?: types.Component.Options) {
      super({
        fromKey: "from",
        ...options
      });
    }

    get graph(): Graph {
      return this.options.graph;
    }

    async process({ input, output }: types.Network.Context) {
      if (!input.hasData(this.options.fromKey)) return;
      const { network, node, data } = await input.getData(this.options.fromKey);
      await Promise.all(
        Object.keys(data).map(port =>
          Promise.all(
            this.graph.getNextPorts({ node, port }).map(async target => {
              await output.sendData({ network, ...target }, data[port]);
            })
          )
        )
      );
    }
  }

  export class Error extends Component {
    async process({ input, output }) {
      console.log(this.id, "process");
    }
  }
}

export namespace Context {
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
    async sendData(
      port: string | types.Network.MsgID,
      data: any
    ): Promise<void> {
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
}
