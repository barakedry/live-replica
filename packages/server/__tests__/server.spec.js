import { EventEmitter} from "../../events/events.js";
import { LiveReplicaServer } from '../src/server';

function createConnection() {
    const connection = new EventEmitter();
    connection.send = jest.fn();
    connection.close = jest.fn();
    return connection;
}

function createClientRequest(overrides) {
    return {
        id: 'clientRequestId',
        path: '', // path to subscribe to on the server
        allowRPC: true,
        allowWrite: true,
        params: {},
        ...overrides
    };
}

describe.skip('LiveReplicaServer', () => {

    it('should allow initializing a new LiveReplica Server with an init object', () => {
        //Arrange
        const dataObject = { test: 123 };
        const options = {
            dataObject
        };

        //Act
        const server = new LiveReplicaServer(options);

        //Assert
        expect(server.get()).toBe(dataObject);
    });

    it('should allow to specify PatchDiff options', () => {
        //Arrange
        const options = {
            dataObject: { test: 123 },
            maxLevels: 1
        };

        //Act
        const server = new LiveReplicaServer(options);

        //Assert
        expect(server.options.maxLevels).toBe(options.maxLevels);
    });

    describe('onConnect', () => {
        it('should register "connection" to listen to subscription requests', () => {
            //Arrange
            const connection = createConnection();
            const server = new LiveReplicaServer({dataObject: {test: 123}});
            const clientRequest = createClientRequest();
            const ack = jest.fn()

            //Act
            server.onConnect(connection);
            connection.emit('subscribe', clientRequest, ack);

            //Assert
            expect(ack).toHaveBeenCalledWith({success: true, writable: true, rpc: true});
            expect(connection.listenerCount('subscribe')).toBe(1);
            expect(connection.send).toHaveBeenCalledWith('apply:clientRequestId', { test: 123 }, {'snapshot': true});
        });

        it('should allow the connection to unregister from listening to subscription requests', () => {
            //Arrange
            const connection = createConnection();
            const server = new LiveReplicaServer();
            const clientRequest = createClientRequest();
            const ack = jest.fn()

            //Act
            const unregister = server.onConnect(connection);
            connection.emit('subscribe', clientRequest, ack);
            unregister();
            connection.emit('subscribe', clientRequest, ack);

            //Assert
            expect(ack).toHaveBeenCalledTimes(1);
            expect(connection.listenerCount('subscribe')).toBe(0);
        });

        it('should update connection on all updates', () => {
            //Arrange
            const connection = createConnection();
            const server = new LiveReplicaServer();
            const clientRequest = createClientRequest();
            const ack = jest.fn()

            //Act
            server.onConnect(connection);
            connection.emit('subscribe', clientRequest, ack);
            server.set(123, 'test');
            server.remove('test');

            //Assert
            expect(connection.send).toHaveBeenCalledWith('apply:clientRequestId', { }, {'snapshot': true});
            expect(connection.send).toHaveBeenCalledWith('apply:clientRequestId', { test: 123 }, {'snapshot': false});
            expect(connection.send).toHaveBeenCalledWith('apply:clientRequestId', { test: server.options.deleteKeyword }, {'snapshot': false});
        });

        it.todo('should support path whitelisting as part of the subscription request');

    });
});