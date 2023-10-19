import {WebSocket, WebSocketServer} from 'ws';
import LiveReplicaWebSocketsServer from "../ws-server/ws-server.js";
import WebSocketClient from "../ws-client/ws-client.js";
import {decode} from "@msgpack/msgpack";
import Replica from "../replica/replica.js";

function createWSServer() {
    return new WebSocketServer({
        path: '/ws',
        maxPayload: 1024 * 1024 * 5, // 5mb limit
        perMessageDeflate: {
            threshold: 1024 * 5,
        },
        port: process.env.PORT || 3000,
    });
}

function createWebSocket() {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/ws`;
        const ws = new WebSocket(url);

        ws.binaryType = 'arraybuffer';
        ws.onerror = async (err) => {
            // reject(err);
        };
        ws.onopen = () => {
            console.info(`Websocket opened`);

            ws.addEventListener('message', (msg) => {
                try {
                    const decoded = decode(msg.data);
                    if (decoded['$event']) {
                        const event = decoded['$event'];
                        // this.socketEvents.emit(`${event.channel}.${event.name}`, ...event.args);
                        console.log(event);
                    }
                } catch (e) {
                }
            });

            resolve(ws);
        };
    });
}


let wsServer;
beforeAll(() => {
    wsServer = createWSServer();
});

afterAll(() => {
    wsServer.close();
});

describe('WS Server and  WS Client integration', () => {
    it('should sync server changes to replica', async () => {
        //Arrange
        const server = new LiveReplicaWebSocketsServer(wsServer);
        const connection = new WebSocketClient(await createWebSocket());
        const replica = new Replica('', { connection });

        //Act
        server.set({a: 1, b: 2}, '');
        await replica.getWhenExists('a')

        //Assert
        expect(replica.get()).toEqual({a: 1, b: 2});
        expect(server.get()).toEqual({a: 1, b: 2});
    });

    it('should sync replica changes to replica', async () => {
        //Arrange
        const server = new LiveReplicaWebSocketsServer(wsServer);
        const connection = new WebSocketClient(await createWebSocket());
        const replica = new Replica('', { connection, allowWrite: true });

        //Act
        replica.set({a: 1, b: 2});
        await server.getWhenExists('a')

        //Assert
        expect(replica.get()).toEqual({a: 1, b: 2});
        expect(server.get()).toEqual({a: 1, b: 2});
    });
});
