import * as events from "events";
import * as redis from "./redis";
import * as types from "./types";

export class MsgBus {
  client: redis.Redis;
  emitter: events.EventEmitter;
  options: types.MsgBus.Options;

  constructor(options?: types.MsgBus.Options) {
    this.options = {
      mqMaxlen: 100,
      queueMaxlen: 100,
      ...options
    };
    this.client = this.options.client || new redis.Redis();
    this.emitter = new events.EventEmitter();
  }

  get mqOptions(): redis.MQ.Options {
    return {
      maxlen: this.options.mqMaxlen
    };
  }

  get queueOptions(): redis.Queue.Options {
    return {
      maxlen: this.options.queueMaxlen
    };
  }

  public mq(key: string, options?: redis.MQ.Options): redis.Module.MQ {
    return this.client.mq(key, { ...this.mqOptions, ...options });
  }

  queue(key: string, options?: redis.Queue.Options): redis.Module.Queue<any> {
    return this.client.queue<any>(key, { ...this.queueOptions, ...options });
  }

  async hasData(
    key: string,
    options?: types.MsgBus.HasDataOptions
  ): Promise<boolean> {
    const opts = { count: 1, ...options };
    return await this.queue(key).has(opts);
  }

  async getData(
    key: string,
    options?: types.MsgBus.HasDataOptions
  ): Promise<types.MsgBus.Data> {
    const opts = { count: 1, ...options };
    const data = await this.queue(key).pop(opts);
    if (opts.count > 1) return data;
    return data[0];
  }

  async sendData(key: string, data: types.MsgBus.MsgData): Promise<void> {
    await this.queue(key).push(data);
  }

  async sendEvent(key: string, data: types.MsgBus.EventData): Promise<void> {
    await this.mq(key).publish(data);
  }

  addListener(key: string, listener: types.MsgBus.Listener): MsgBus {
    this.removeListener(key);
    let remove = false;
    this.emitter.addListener(key, () => {
      remove = true;
    });
    (async () => {
      const mq = this.mq(key);
      while (true) {
        if (remove) return;
        await Promise.all(
          (await mq.read()).map(async msg => {
            try {
              await listener(msg.data);
              await mq.delete(msg.id);
            } catch (err) {
              console.error(err);
            }
          })
        );
      }
    })();
    return this;
  }

  removeListener(key: string): MsgBus {
    this.emitter.emit(key, "remove");
    this.emitter.removeAllListeners(key);
    return this;
  }

  hasListeners(key: string): boolean {
    return this.emitter.listenerCount(key) > 0;
  }
}
