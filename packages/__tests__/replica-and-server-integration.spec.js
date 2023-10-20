import { EventEmitter} from "../events/events.js";
import { LiveReplicaServer } from '../server';
import { Replica } from '../replica/replica';
import LiveReplicaSocket from "../socket/socket.js";

function createBaseSocket() {
    const connection = new EventEmitter();
    connection.connect = jest.fn();
    connection.disconnect = jest.fn();
    connection.fake = true;
    return connection;
}
describe('Replica and Server integration', () => {
    it('should keep replica and server in sync', () => {
        //Arrange
        const dataObject = {a: 1, b: 2};
        const server = new LiveReplicaServer({dataObject});
        const replica = new Replica('');
        const connection = new LiveReplicaSocket(createBaseSocket());

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, jest.fn(), jest.fn());

        //Assert
        expect(replica.get()).toEqual(dataObject);
        expect(server.get()).toEqual(dataObject);
    });

    it('should notify replica when subscription is successful', () => {
        //Arrange
        const dataObject = {a: 1, b: 2};
        const server = new LiveReplicaServer({dataObject});
        const replica = new Replica('');
        const connection = new LiveReplicaSocket(createBaseSocket());
        const subscribeSuccessCallback = jest.fn();

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, subscribeSuccessCallback, jest.fn());

        //Assert
        expect(subscribeSuccessCallback).toHaveBeenCalledWith({success: true});
    });

    it.todo('should notify replica when subscription is rejected');

    it('should sync replica with server changes', () => {
        //Arrange
        const dataObject = {a: 1, b: 2};
        const server = new LiveReplicaServer({dataObject});
        const replica = new Replica('');
        const connection = new LiveReplicaSocket(createBaseSocket());

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, jest.fn(), jest.fn());
        server.set({a: 3});

        //Assert
        expect(replica.get()).toEqual({a: 3});
        expect(server.get()).toEqual({a: 3});
    });

    it.failing('should sync server with replica changes', async () => {
        //Arrange
        const dataObject = {a: 1, b: 2};
        const server = new LiveReplicaServer({ path:'root', dataObject });
        const replica = new Replica('root', {
            allowRPC: true,
            allowWrite: true
        });
        const connection = new LiveReplicaSocket(createBaseSocket());

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, jest.fn(), jest.fn());
        replica.set({ a: 3 });
        await replica.getWhenExists('a');
        // await server.getWhenExists('root.a');

        //Assert
        expect(replica.get()).toEqual({ a: 3 });
        // expect(server.get()).toEqual({ a: 3 });
    }, 500);

    it('should not allow any replica changes without explicitly requesting write permission', () => {
        //Arrange
        const dataObject = {a: 1, b: 2};
        const server = new LiveReplicaServer({dataObject});
        const replica = new Replica('');
        const connection = new LiveReplicaSocket(createBaseSocket());

        //Act
        server.onConnect(connection);
        replica.subscribeRemote(connection, jest.fn(), jest.fn());
        replica.set({a: 3});
        replica.remove('a');
        replica.apply({b: 3});

        //Assert
        expect(replica.isReadOnly).toBe(true);
        expect(replica.get()).toEqual({a: 1, b: 2});
        expect(server.get()).toEqual({a: 1, b: 2});
    })

    describe('reset', () => {
        //todo: shouldn't we reset to dataObject?
        it.failing('should reset replica to an empty object', () => {
            //Arrange
            const dataObject = {a: 1, b: 2};
            const server = new LiveReplicaServer({dataObject});
            const replica = new Replica('');
            const connection = new LiveReplicaSocket(createBaseSocket());

            //Act
            server.onConnect(connection);
            replica.subscribeRemote(connection, jest.fn(), jest.fn());
            replica.reset();
            //todo: unsubscribeRemote -> connection.send -> socket_socketSend never resolved

            //Assert
            expect(replica.get()).toEqual({});
            expect(server.get()).toEqual({});
        });
    });

    it.todo('subscribed')
    it.todo('synced')
});