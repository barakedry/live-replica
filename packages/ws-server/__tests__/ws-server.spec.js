import { WebSocketServer } from 'ws';

function createWSServer() {
    const wss = new WebSocketServer({
        path: '/ws',
        maxPayload: 1024 * 1024 * 5, // 5mb limit
        perMessageDeflate: {
            threshold: 1024 * 5,
        },
        noServer: true,
    });

    return wss;
}
describe('WS Server', () => {
    it.todo('some test to be written in the future');
});
