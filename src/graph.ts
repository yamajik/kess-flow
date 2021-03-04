import * as fs from "fs";
import * as types from "./types";

export class Graph {
  options: types.Graph.Options;
  routeMap: Map<string, types.Graph.ConnectionPort[]>;

  constructor(options: types.Graph.Options) {
    this.options = options;
    this.routeMap = new Map<string, types.Graph.ConnectionPort[]>();
    this.connections.forEach(({ src, tgt }) => {
      const srckey = cpToString(src);
      if (!this.routeMap.has(srckey)) {
        this.routeMap.set(srckey, []);
      }
      this.routeMap.get(srckey).push(tgt);
    }, {});
  }

  static load(filename: string): Graph {
    return new Graph(JSON.parse(fs.readFileSync(filename).toString()));
  }

  get nodes(): types.Graph.Node[] {
    return Object.keys(this.options.processes).map(id => ({
      id,
      ...this.options.processes[id]
    }));
  }

  get connections(): types.Graph.Connection[] {
    return (this.options.connections || []).map(({ src, tgt }) => ({
      src: { node: src.process, port: src.port },
      tgt: { node: tgt.process, port: tgt.port }
    }));
  }

  getNextPorts(np: types.Graph.ConnectionPort): types.Graph.ConnectionPort[] {
    return this.routeMap.get(cpToString(np)) || [];
  }

  diff(old?: Graph): types.Graph.DiffResults {
    const results: types.Graph.DiffResults = {
      nodes: {
        added: [],
        removed: [],
        updated: []
      }
    };
    if (!old) {
      Object.keys(this.options.processes).forEach(id => {
        const newNode = this.options.processes[id];
        results.nodes.added.push({ id, ...newNode });
      });
    } else {
      const nodeIds = new Set([
        ...Object.keys(this.options.processes),
        ...Object.keys(old.options.processes)
      ]);
      nodeIds.forEach(id => {
        const oldNode = old.options.processes[id],
          newNode = this.options.processes[id];
        if (!oldNode) {
          results.nodes.added.push({ id, ...newNode });
        } else if (!newNode) {
          results.nodes.removed.push({ id, ...oldNode });
        } else if (JSON.stringify(newNode) !== JSON.stringify(oldNode)) {
          results.nodes.updated.push({ id, ...newNode });
        }
      });
    }
    return results;
  }
}

export function cpFromString(str: string): types.Graph.ConnectionPort {
  const [node, port] = str.split(".");
  return { node, port };
}

export function cpToString(cp: types.Graph.ConnectionPort): string {
  return `${cp.node}.${cp.port}`;
}
