import * as uuid from "uuid";
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
