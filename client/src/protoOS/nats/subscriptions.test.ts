import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fromBinary } from "@bufbuild/protobuf";
import type { Msg, Subscription } from "@nats-io/nats-core";

import { processSubscription } from "./subscriptions";

vi.mock("@bufbuild/protobuf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bufbuild/protobuf")>();
  return { ...actual, fromBinary: vi.fn() };
});

const mockFromBinary = vi.mocked(fromBinary);

// fromBinary is mocked, so the schema only needs a typeName for the log messages.
type ProcessSchema = Parameters<typeof processSubscription>[1];
const schema = { typeName: "test.Message" } as unknown as ProcessSchema;

function createSubscription(messages: Array<{ data?: Uint8Array }>): Subscription {
  async function* iterator() {
    for (const message of messages) {
      yield message as Msg;
    }
  }
  return { [Symbol.asyncIterator]: iterator } as unknown as Subscription;
}

describe("processSubscription", () => {
  beforeEach(() => {
    mockFromBinary.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("logs a decode failure as a warning and keeps processing later messages", async () => {
    const decoded = { value: 1 };
    mockFromBinary.mockImplementationOnce(() => {
      throw new Error("bad bytes");
    });
    mockFromBinary.mockReturnValueOnce(decoded as never);

    const onMessage = vi.fn();
    const sub = createSubscription([{ data: new Uint8Array([1]) }, { data: new Uint8Array([2]) }]);

    processSubscription(sub, schema, onMessage);

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(onMessage).toHaveBeenCalledWith(decoded);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  test("logs a handler error separately from a decode failure and keeps processing", async () => {
    const decoded = { value: 2 };
    mockFromBinary.mockReturnValue(decoded as never);

    const onMessage = vi.fn().mockImplementationOnce(() => {
      throw new Error("handler boom");
    });
    const sub = createSubscription([{ data: new Uint8Array([1]) }, { data: new Uint8Array([2]) }]);

    processSubscription(sub, schema, onMessage);

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("skips messages without a payload", async () => {
    const decoded = { value: 3 };
    mockFromBinary.mockReturnValue(decoded as never);

    const onMessage = vi.fn();
    const sub = createSubscription([{ data: undefined }, { data: new Uint8Array([2]) }]);

    processSubscription(sub, schema, onMessage);

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(mockFromBinary).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(decoded);
  });
});
