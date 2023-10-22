import {WebSocket, WebSocketServer} from 'ws';
import LiveReplicaWebSocketsServer from "../ws-server/ws-server.js";
import WebSocketClient from "../ws-client/ws-client.js";
import Replica from "../replica/replica.js";
import {flushCycle} from "../patch-diff/__tests__/patch-diff.spec.js";

function createWSServer() {
    return new Promise((resolve, reject) => {
        const wss = new WebSocketServer({
            path: '/ws',
            maxPayload: 1024 * 1024 * 5, // 5mb limit
            perMessageDeflate: {
                threshold: 1024 * 5,
            },
            port: process.env.PORT || 3000,
        }, () => resolve(wss));
    });
}

function createWebSocket() {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/ws`;
        const ws = new WebSocket(url);

        ws.binaryType = 'arraybuffer';
        ws.onerror = async (err) => {
            reject(err);
        };
        ws.onopen = () => {
            console.info(`Websocket opened`);
            resolve(ws);
        };
    });
}


let wsServer;
let connection;
let server;
beforeAll(async () => {
    wsServer = await createWSServer();
    server = new LiveReplicaWebSocketsServer(wsServer)
    const ws = await createWebSocket();
    connection = new WebSocketClient(ws);
});

afterEach(() => {
    server.destroy();
});

afterAll((done) => {
    connection.baseSocket.close();
    wsServer.close(() => {
        console.log('ws server closed');
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
                subscribeSuccessCallback: jest.fn(function() {
                    //Assert
                    expect(replicaOptions.subscribeSuccessCallback).toHaveBeenCalledWith({success: true, writable: null, rpc: null});
                    done();
                })
            };
            const replica = new Replica('root', replicaOptions);
        });

        it('should sync server changes to replica', async () => {
            //Arrange
            const replica = new Replica('root', { connection });

            //Act
            await replica.synced;
            server.set({a: 1, b: {c: 2}}, 'root');
            await replica.getWhenExists('a')

            //Assert
            expect(replica.get()).toEqual({a: 1, b: { c: 2 }});
            expect(server.get()).toEqual({ root: {a: 1, b: { c: 2}}});
        });

        it('should sync replica changes to server', async () => {
            //Arrange
            const replica = new Replica('root', { connection, allowWrite: true });

            //Act
            await replica.synced;
            replica.set({c: 1, e: 3});
            replica.remove('e');
            replica.apply({d: 2});

            await server.getWhenExists('root.d');
            await replica.getWhenExists('d');

            //Assert
            expect(replica.get()).toEqual({ c: 1, d: 2 });
            expect(server.get()).toEqual({ root: { c: 1, d: 2 }});
        });

        it('should allow to unsubscribe', async () => {
            //Arrange
            server.set({a: 1, b: {c: 2}}, 'root');
            const replica = new Replica('root', { connection, allowWrite: true });
            await replica.getWhenExists('a');
            const destroyedCallback = jest.fn();
            replica.on('destroyed', destroyedCallback);

            //Act
            await replica.destroy();
            server.set({a: 2}, 'root');
            await flushCycle(10);

            //Assert
            expect(replica.get()).toEqual({a: 1, b: { c: 2 }});
            expect(destroyedCallback).toBeCalled();
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
                subscribeRejectCallback: jest.fn(function() {
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
            const initObject = { readonly: { a: 1 }, readwrite: { b: 1}};
            server.set(initObject);

            //Act
            //create two replicas, one read only and one read write
            const readOnlyReplica = new Replica('readonly', { connection });
            const readWriteReplica = new Replica('readwrite', { connection });
            //wait for both replicas to connect
            await readOnlyReplica.synced;
            await readWriteReplica.synced;
            //modify the replicas
            readOnlyReplica.set({key: 'val'}, 'a');
            readWriteReplica.set({ c: {key: 'val'}, d: 5 });
            //wait for the changes to reflect on replica and server
            await readWriteReplica.getWhenExists('c');
            await server.getWhenExists('readwrite.c');


            //Assert
            expect(readOnlyReplica.get()).toEqual({ a: 1 });
            expect(readWriteReplica.get()).toEqual({c: { key: 'val' }, d: 5 });
            expect(server.get()).toEqual({ readonly: { a: 1 }, readwrite: {c: { key: 'val' }, d: 5 }});
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
            await expect(replica.data.myRPC()).rejects.toThrow('testing rpc errors');
        });
    });
    
    describe('Connection handling', () => {
        it('should auto reconnect', () => {
            
        });
    });
});
