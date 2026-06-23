import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NatsConnection } from "@nats-io/nats-core";

import { connectToNats, disconnectFromNats } from "./connection";
import NatsProvider from "./NatsProvider";
import { useNatsConnection } from "./useNatsConnection";

const mocks = vi.hoisted(() => ({
  connectToNats: vi.fn(),
  disconnectFromNats: vi.fn(),
}));

vi.mock("./connection", () => ({
  connectToNats: mocks.connectToNats,
  disconnectFromNats: mocks.disconnectFromNats,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

interface MockConnection {
  connection: NatsConnection;
  closed: Deferred<void | Error>;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createMockConnection(id: string): MockConnection {
  const closed = createDeferred<void | Error>();
  const connection = {
    id,
    closed: vi.fn(() => closed.promise),
  } as unknown as NatsConnection;

  return { connection, closed };
}

function ConnectionProbe() {
  const { connection, reconnect, state } = useNatsConnection();
  const connectionId = (connection as (NatsConnection & { id?: string }) | null)?.id ?? "none";

  return (
    <>
      <div data-testid="state">{state}</div>
      <div data-testid="connection">{connectionId}</div>
      <button type="button" onClick={reconnect}>
        Reconnect
      </button>
    </>
  );
}

function renderProvider() {
  return render(
    <NatsProvider>
      <ConnectionProbe />
    </NatsProvider>,
  );
}

describe("NatsProvider", () => {
  const mockConnectToNats = vi.mocked(connectToNats);
  const mockDisconnectFromNats = vi.mocked(disconnectFromNats);

  beforeEach(() => {
    vi.clearAllMocks();
    mockDisconnectFromNats.mockResolvedValue(undefined);
  });

  test("disconnects a late first connection when a newer reconnect wins", async () => {
    const firstConnect = createDeferred<NatsConnection>();
    const secondConnect = createDeferred<NatsConnection>();
    const firstConnection = createMockConnection("first");
    const secondConnection = createMockConnection("second");
    mockConnectToNats.mockReturnValueOnce(firstConnect.promise).mockReturnValueOnce(secondConnect.promise);

    renderProvider();
    expect(screen.getByTestId("state")).toHaveTextContent("connecting");

    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(mockConnectToNats).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondConnect.resolve(secondConnection.connection);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("connection")).toHaveTextContent("second"));
    expect(screen.getByTestId("state")).toHaveTextContent("connected");

    await act(async () => {
      firstConnect.resolve(firstConnection.connection);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockDisconnectFromNats).toHaveBeenCalledWith(firstConnection.connection));
    expect(screen.getByTestId("connection")).toHaveTextContent("second");
    expect(screen.getByTestId("state")).toHaveTextContent("connected");
  });

  test("disconnects a connection that resolves after unmount", async () => {
    const connect = createDeferred<NatsConnection>();
    const lateConnection = createMockConnection("late");
    mockConnectToNats.mockReturnValueOnce(connect.promise);

    const { unmount } = renderProvider();
    unmount();

    await act(async () => {
      connect.resolve(lateConnection.connection);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockDisconnectFromNats).toHaveBeenCalledWith(lateConnection.connection));
  });

  test("moves back to disconnected when the active connection closes", async () => {
    const connect = createDeferred<NatsConnection>();
    const activeConnection = createMockConnection("active");
    mockConnectToNats.mockReturnValueOnce(connect.promise);

    renderProvider();

    await act(async () => {
      connect.resolve(activeConnection.connection);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("connection")).toHaveTextContent("active"));
    expect(screen.getByTestId("state")).toHaveTextContent("connected");

    await act(async () => {
      activeConnection.closed.resolve(undefined);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("connection")).toHaveTextContent("none"));
    expect(screen.getByTestId("state")).toHaveTextContent("disconnected");
  });
});
