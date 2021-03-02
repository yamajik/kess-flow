import * as uuid from "uuid";
import { Graph } from "./graph";
import * as types from "./types";

export class Component {
  options: types.Component.Options;

  constructor(options?: types.Component.Options) {
    this.options = {
      id: uuid.v4(),
      ...options
    };
  }

  get id(): string {
    return this.options.id;
  }

  async setup(_: types.Network.Context) {
    console.log(this.id, "setup");
  }

  async process(_: types.Network.Context) {
    console.log(this.id, "process");
  }

  async teardown() {
    console.log(this.id, "teardown");
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
