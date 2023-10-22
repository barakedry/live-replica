import {WebSocket, WebSocketServer} from 'ws';
import LiveReplicaWebSocketsServer from "../ws-server/ws-server.js";
import WebSocketClient from "../ws-client/ws-client.js";
import Replica from "../replica/replica.js";

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
    describe('Sync', () => {
        it('should sync server changes to replica', async () => {
            //Arrange
            const replica = new Replica('root', { connection });

            //Act
            await replica.synced;
            server.set({a: 1, b: 2}, 'root');
            await replica.getWhenExists('a')

            //Assert
            expect(replica.get()).toEqual({a: 1, b: 2});
            expect(server.get()).toEqual({ root: {a: 1, b: 2}});
        });

        it('should sync replica changes to server', async () => {
            //Arrange
            const replica = new Replica('root', { connection, allowWrite: true });

            //Act
            await replica.synced;
            replica.set({c: 1});
            await server.getWhenExists('root.c');
            await replica.getWhenExists('c');

            //Assert
            expect(replica.get()).toEqual({ c: 1 });
            expect(server.get()).toEqual({ root: { c: 1 }});
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
            readWriteReplica.set({ c: {key: 'val'}, d: 5});
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
        it.todo('should be able to invoke methods on server from the replica');
        it('should be able to invoke methods on server from the replica', () => {
            //Arrange
            const replica = new Replica('root', { connection, allowRPC: true });

            //Act

        });
    });
    
    describe('Connection handling', () => {
        it('should auto reconnect', () => {
            
        });
    });
});
