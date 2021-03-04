import * as ts from "typescript";
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
  graph?: Graph;
  running: boolean;

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
    this.running = false;
    if (this.options.graph) {
      this.loadFromGraph(this.options.graph);
    }
    if (this.options.nodes) {
      this.loadNodes(this.options.nodes);
    }
  }

  static load<T extends Network>(
    this: types.Network.StaticThis<T>,
    filename: string,
    options?: types.Network.Options
  ): T {
    const network = new this(options);
    network.loadFromGraph(Graph.load(filename));
    return network;
  }

  update(filename: string): this {
    this.updateFromGraph(Graph.load(filename));
    return this;
  }

  get id(): string {
    return this.options.id;
  }

  addNode(node: Component): Component {
    const context = this.context({
      source: { network: this.id, node: node.id },
      target: { network: this.id, node: this.options.router }
    });
    this.nodes.set(node.id, node);
    this.msgbus.addListener(`${this.id}.${node.id}`, async () => {
      await node.process(context);
    });
    if (this.running) {
      node.setup(context);
    }
    return node;
  }

  removeNode(node: Component): boolean {
    this.msgbus.removeListener(`${this.id}.${node.id}`);
    if (this.running) {
      node.teardown();
    }
    return this.nodes.delete(node.id);
  }

  getComponent(options: types.Network.GetComponentOptions): Component {
    const opts = {
      type: "default",
      ...options
    };
    if (this.options.getComponent) {
      const node = this.options.getComponent(opts);
      if (node) return node;
    }

    const compnentClass = this.options.components[opts.type];
    if (!compnentClass) {
      return new Component(opts);
    }
    return new compnentClass(opts);
  }

  loadFromGraph(graph: Graph): void {
    this.graph = graph;
    graph.nodes.forEach(node => {
      this.addNode(this.getComponent(node));
    });
    if (this.options.router) {
      this.addNode(
        this.getComponent({
          type: this.options.router,
          id: this.options.router,
          graph
        })
      );
    }
  }

  updateFromGraph(graph: Graph): void {
    const { nodes } = graph.diff(this.graph);
    const router = this.getComponent({
      type: this.options.router,
      id: this.options.router,
      graph
    });
    this.removeNode(router);
    nodes.removed.forEach(n => {
      const node = this.getComponent(n);
      this.removeNode(node);
    });
    nodes.updated.forEach(n => {
      const node = this.getComponent(n);
      this.removeNode(node);
      this.addNode(node);
    });
    nodes.added.forEach(n => {
      const node = this.getComponent(n);
      this.addNode(node);
    });
    this.addNode(router);
    this.graph = graph;
  }

  loadNodes(nodes: Component[]): void {
    nodes.forEach(node => {
      this.addNode(node);
    });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    for (const [_, node] of this.nodes) {
      const context = this.context({
        source: { network: this.id, node: node.id },
        target: { network: this.id, node: this.options.router }
      });
      await node.setup(context);
    }
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    for (const [_, node] of this.nodes) {
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

export function getTranspileComponent(
  options: types.Network.GetComponentOptions
): Component | null {
  if (!options.metadata?.def?.code) return null;
  const ComponentClass: types.Component.MetaClass = eval(
    ts.transpileModule(options.metadata.def.code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2016,
        module: ts.ModuleKind.CommonJS
      }
    }).outputText
  );
  return new ComponentClass(options);
}

export class TranspileNetwork extends Network {
  constructor(options?: types.Network.Options) {
    super({
      getComponent: getTranspileComponent,
      ...options
    });
  }
}
