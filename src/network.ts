import * as uuid from "uuid";
import { Component, Router } from "./components";
import { Input, Output } from "./context";
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
      default: Component,
      [this.options.router]: Router,
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
      input: new Input(this.msgbus, options),
      output: new Output(this.msgbus, options)
    };
  }
}
