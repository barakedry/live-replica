import {WebSocketServer, WebSocket} from 'ws';
import LiveReplicaWebSocketsServer from "../ws-server/ws-server.js";
import WebSocketClient from "../ws-client/ws-client.js";
import {decode} from "@msgpack/msgpack";
import Replica from "../replica/replica.js";

function createWSServer() {
    const wss = new WebSocketServer({
        path: '/ws',
        maxPayload: 1024 * 1024 * 5, // 5mb limit
        perMessageDeflate: {
            threshold: 1024 * 5,
        },
        port: 3000
    });

    return wss;
}

function createWebSocket() {
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
    };

    return ws;
}

describe('WS Server and WS Client integration', () => {
    it.only('should keep replica and server in sync', () => {
        //Arrange
        const server = new LiveReplicaWebSocketsServer(createWSServer());
        const connection = new WebSocketClient(createWebSocket());
        const replica = new Replica('');

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, jest.fn(), jest.fn());

        //Assert
        expect(replica.get()).toEqual({});
        expect(server.get()).toEqual({});
    });
});
