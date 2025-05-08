import { WebSocket, WebSocketServer } from 'ws';
import LiveReplicaWebSocketsServer from "../ws-server/ws-server";
import WebSocketClient from "../ws-client/ws-client";
import Replica from "../replica/replica";
import { flushCycle } from "../patch-diff/__tests__/patch-diff.spec";
import { oncePerSubscription } from "../server/src/middlewares";
import type { Server as WSServer, WebSocket as WSWebSocket } from 'ws';
import type WebSocketClientType from '../ws-client/ws-client';
import type LiveReplicaWebSocketsServerType from '../ws-server/ws-server';

let wsServer: WSServer;
let connection: InstanceType<typeof WebSocketClientType>;
let server: LiveReplicaWebSocketsServerType;

function createWSServer(): Promise<WSServer> {
    return new Promise<WSServer>((resolve, reject) => {
        const wss: WSServer = new WebSocketServer({
            path: '/ws',
            maxPayload: 1024 * 1024 * 5, // 5mb limit
            perMessageDeflate: {
                threshold: 1024 * 5,
            },
            port: Number(process.env.PORT) || 3000,
        }, () => resolve(wss));
    });
}

function createWebSocket(): Promise<WSWebSocket> {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/ws`;
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        ws.onerror = (err) => {
            reject(err);
        };
        ws.onopen = () => {
            // console.info(`Websocket opened`);
            resolve(ws);
        };
    });
}

beforeAll(async () => {
    wsServer = await createWSServer();
    server = new LiveReplicaWebSocketsServer(wsServer)
    const ws = await createWebSocket();
    // @ts-expect-error WebSocketClient constructor expects BaseSocket type
    connection = new WebSocketClient(ws);
});

afterEach(() => {
    server.destroy();
});

afterAll((done) => {
    connection?.baseSocket.close();
    connection?.disconnect();

    // Close all client connections
    wsServer.clients.forEach((client) => {
        client.terminate();
    });

    wsServer.close((e) => {
        // console.log('ws server closed', e);
        done();
    });
});

describe('WS Server and  WS Client integration', () => {
    describe('Error handling', () => {
        it.each([
            ['not provided', undefined],
            ['not instance of LiveReplicaSocket', {}]
        ])('should throw if socket is %s', (_desc, socket) => {
            const replica = new Replica('root');

            //Act & Assert
            expect(() => replica.subscribeRemote(socket)).toThrow('undefined connection or not a LiveReplicaSocket');
        });
    });

    describe('Sync', () => {
        it('should notify on successful subscription', (done) => {
            //Act
            const replicaOptions = {
                connection,
                subscribeSuccessCallback: jest.fn(function () {
                    //Assert
                    expect(replicaOptions.subscribeSuccessCallback).toHaveBeenCalledWith({ success: true, writable: null, rpc: null });
                    done();
                })
            };
            const replica = new Replica('root', replicaOptions);
        });

        it('should sync server changes to replica', async () => {
            // Arrange
            const replica = new Replica('root', { connection });
            // Attach the listener before triggering server changes
            const syncedPromise = replica.synced;
            server.set({ a: 1, b: { c: 2 } }, 'root');
            await syncedPromise;
            await replica.getWhenExists('a');
            // Assert
            expect(replica.get()).toEqual({ a: 1, b: { c: 2 } });
            expect(server.get()).toEqual({ root: { a: 1, b: { c: 2 } } });
        });

        it('should sync replica changes to server', async () => {
            // Arrange
            const replica = new Replica('root', { connection, allowWrite: true });
            const syncedPromise = replica.synced;
            await syncedPromise;
            replica.set({ c: 1, e: 3 });
            replica.remove('e');
            replica.apply({ d: 2 });
            await server.getWhenExists('root.d');
            await replica.getWhenExists('d');
            // Assert
            expect(replica.get()).toEqual({ c: 1, d: 2 });
            expect(server.get()).toEqual({ root: { c: 1, d: 2 } });
        });

        it('should allow to unsubscribe', async () => {
            // Arrange
            server.set({ a: 1, b: { c: 2 } }, 'root');
            const replica = new Replica('root', { connection, allowWrite: true });
            const syncedPromise = replica.synced;
            await syncedPromise;
            await replica.getWhenExists('a');
            const destroyedCallback = jest.fn();
            replica.on('destroyed', destroyedCallback);
            // Act
            replica.destroy();
            server.set({ a: 2 }, 'root');
            await flushCycle(10);
            // Assert
            expect(replica.get()).toEqual({ a: 1, b: { c: 2 } });
            expect(destroyedCallback).toHaveBeenCalled();
        });
    });

    describe('Middleware', () => {
        it('should be able to reject replica subscriptions', (done) => {
            //Arrange
            const middlewareFake = jest.fn((request, reject, next) => {
                reject('reason: testing reject');
            });
            server.use(middlewareFake);

            //Act
            const replicaOptions = {
                connection,
                subscribeRejectCallback: jest.fn(function () {
                    //Assert
                    expect(replicaOptions.subscribeRejectCallback).toHaveBeenCalledWith('reason: testing reject');
                    done();
                }),
                subscribeSuccessCallback: jest.fn()
            };
            const replica = new Replica('root', replicaOptions);
        });

        it('should be able to modify replica subscriptions', async () => {
            //Arrange
            const middlewareFake = jest.fn((request, reject, next) => {
                //middleware forces some client subscriptions to be read only
                if (request.path === 'readonly') {
                    request.allowWrite = false;
                    request.allowRPC = false;
                } else {
                    request.allowWrite = true;
                    request.allowRPC = true;
                }
                next();
            });
            server.use(middlewareFake);
            const initObject = { readonly: { a: 1 }, readwrite: { b: 1 } };
            server.set(initObject);

            //Act
            //create two replicas, one read only and one read write
            const readOnlyReplica = new Replica('readonly', { connection });
            const readWriteReplica = new Replica('readwrite', { connection });
            //wait for both replicas to connect
            await readOnlyReplica.synced;
            await readWriteReplica.synced;
            //modify the replicas
            readOnlyReplica.set({ key: 'val' }, 'a');
            readWriteReplica.set({ c: { key: 'val' }, d: 5 });
            //wait for the changes to reflect on replica and server
            await readWriteReplica.getWhenExists('c');
            await server.getWhenExists('readwrite.c');


            //Assert
            expect(readOnlyReplica.get()).toEqual({ a: 1 });
            expect(readWriteReplica.get()).toEqual({ c: { key: 'val' }, d: 5 });
            expect(server.get()).toEqual({ readonly: { a: 1 }, readwrite: { c: { key: 'val' }, d: 5 } });
        });

        describe('OncePerSubscription', () => {
            it('should invoke middleware callbacks once on first subscription', async () => {
                //Arrange
                const onFirstSubscribe = jest.fn((req, reject, approve) => approve());
                let lastUnsubscribeResolve: () => void;
                const lastUnsubscribePromise = new Promise<void>(resolve => { lastUnsubscribeResolve = resolve; });
                const onLastUnsubscribe = jest.fn((lastRequest) => {
                    console.log('last request', lastRequest);
                    lastUnsubscribeResolve();
                });
                server.set({ a: { b: { c: 1 } } });
                // @ts-expect-error
                server.use(oncePerSubscription(onFirstSubscribe, onLastUnsubscribe));

                //Act
                //new Replicas will connect and create subscription requests on the server
                const replicaA = new Replica('a', { connection });
                const replicaB = new Replica('a', { connection });

                //wait for the replicas to connect
                await replicaA.getWhenExists('b');
                await flushCycle(10);

                //destroy the replicas and trigger unsubscribe
                replicaA.destroy();
                replicaB.destroy();
                await lastUnsubscribePromise;
                //Assert - onFirstSubscribe and onLastUnsubscribe should be called exactly once for each path
                expect(onFirstSubscribe).toHaveBeenCalledWith(expect.objectContaining({ path: 'a' }), expect.any(Function), expect.any(Function));
                expect(onFirstSubscribe).toHaveBeenCalledTimes(1);
                expect(onLastUnsubscribe).toHaveBeenCalledWith(expect.objectContaining({ path: 'a' }), expect.any(Function));
                expect(onLastUnsubscribe).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('RPC', () => {
        it('should be able to invoke methods on server from the replica', async () => {
            //Arrange
            const replica = new Replica('root', { connection, allowRPC: true });
            server.set({
                root: {
                    myRPC: function myRPC() {
                        return 'hello';
                    }
                }
            });
            await replica.getWhenExists('myRPC');

            //Act
            // @ts-expect-error
            const result = await replica.data.myRPC();

            //Assert
            expect(result).toEqual('hello');
        });

        it('should be able to invoke async methods on server from the replica', async () => {
            //Arrange
            const replica = new Replica('root', { connection, allowRPC: true });
            server.set({
                root: {
                    myRPC: function myRPC() {
                        return new Promise((resolve) => {
                            setTimeout(() => resolve('hello after 1ms'), 1);
                        });
                    }
                }
            });
            await replica.getWhenExists('myRPC');

            //Act
            // @ts-expect-error
            const result = await replica.data.myRPC();

            //Assert
            expect(result).toEqual('hello after 1ms');
        });

        it('should resolve with error for async rejections', async () => {
            //Arrange
            const replica = new Replica('root', { connection, allowRPC: true });
            server.set({
                root: {
                    myRPC: function myRPC() {
                        return new Promise((resolve, reject) => {
                            const error = new Error();
                            error.name = 'RPCError';
                            error.message = 'testing rpc errors';
                            setTimeout(() => reject(error), 1);
                        });
                    }
                }
            });
            await replica.getWhenExists('myRPC');

            //Act & Assert
            // @ts-expect-error
            await expect(replica.data.myRPC()).rejects.toThrow('testing rpc errors');
        });
    });
});
