import * as IORedis from "ioredis";
import * as utils from "../utils";
import { MQ, Queue, RedisOptions } from "./types";
import * as us from "microseconds";
const RedisMock: typeof IORedis = require("ioredis-mock");

export class Redis {
  client: IORedis.Redis;

  constructor(options?: RedisOptions) {
    const opts = {
      type: "mock",
      ...options
    };
    switch (opts.type) {
      case "mock":
        this.client = new RedisMock(opts);
        break;
      default:
        this.client = new IORedis(opts);
        break;
    }
  }

  mq(key: string, options?: MQ.Options): Module.MQ {
    return new Module.MQ(this.client, key, options);
  }

  queue<T>(key: string, options?: Queue.Options): Module.Queue<T> {
    return new Module.Queue(this.client, key, options);
  }
}

namespace Module {
  class Base {
    client: IORedis.Redis;
    key: string;

    constructor(client: IORedis.Redis, key: string) {
      this.client = client;
      this.key = key;
    }
  }

  export class MQ extends Base {
    options: MQ.Options;

    constructor(client: IORedis.Redis, key: string, options?: MQ.Options) {
      super(client, key);
      this.options = {
        maxlen: 100,
        block: 60,
        ...options
      };
    }

    parseMessageData(data: IORedis.ValueType[]): MQ.MessageData {
      const obj = {};
      for (const [key, value] of utils.group(data, 2)) {
        obj[key] = value;
      }
      return obj;
    }

    formatMessageData(data: MQ.MessageData): IORedis.ValueType[] {
      let array: any[] = [];
      for (let key in data) {
        array.push(key, data[key]);
      }
      return array;
    }

    async subscribe(handler: MQ.SubscribeHandler): Promise<void> {
      while (true) {
        await Promise.all(
          (await this.read()).map(async msg => {
            try {
              await handler(msg.data);
              await this.delete(msg.id);
            } catch (err) {
              console.error(err);
            }
          })
        );
      }
    }

    async publish(data: MQ.MessageData): Promise<void> {
      await this.client.xadd(
        this.key,
        "MAXLEN",
        this.options.maxlen,
        `${us.now() * 1000}`,
        ...this.formatMessageData(data)
      );
    }

    async read(): Promise<MQ.Message[]> {
      const res =
        (await this.client.xread(
          "BLOCK",
          this.options.block,
          "STREAMS",
          this.key,
          "$"
        )) || [];
      return utils.flat(
        res.map(([key, items]) =>
          items.map(([id, data]) => ({
            key,
            id,
            data: this.parseMessageData(data)
          }))
        )
      );
    }

    async range(): Promise<any> {
      return await this.client.xrange(this.key, "-", "+");
    }

    async len(): Promise<number> {
      return await this.client.xlen(this.key);
    }

    async delete(id: string): Promise<void> {
      await this.client.xdel(this.key, id);
    }
  }

  export class Queue<T> extends Base {
    options: Queue.Options;

    constructor(client: IORedis.Redis, key: string, options?: Queue.Options) {
      super(client, key);
      this.options = {
        maxlen: 100,
        ...options
      };
    }

    async len(): Promise<number> {
      return await this.client.llen(this.key);
    }

    async has(options?: Queue.HasOptions): Promise<boolean> {
      const opts = {
        count: 1,
        ...options
      };
      return (
        (await this.client.keys(this.key)).length > 0 &&
        (await this.len()) >= opts.count
      );
    }

    async pop(options?: Queue.PopOptions): Promise<any[]> {
      const opts = {
        count: 1,
        ...options
      };
      const [[rangeerr, items], [trimerr, _]] = await this.client
        .multi()
        .lrange(this.key, -opts.count, -1)
        .ltrim(this.key, 0, -opts.count - 1)
        .exec();
      const err = rangeerr || trimerr;
      if (err) throw err;
      return items.map(i => JSON.parse(i));
    }

    async push(...items: T[]): Promise<void> {
      const [[pusherr, _], [trimerr, __]] = await this.client
        .multi()
        .lpush(this.key, ...items.map(i => JSON.stringify(i)))
        .ltrim(this.key, 0, this.options.maxlen)
        .exec();
      const err = pusherr || trimerr;
      if (err) throw err;
    }
  }
}
