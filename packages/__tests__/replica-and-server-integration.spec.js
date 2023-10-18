import { EventEmitter} from "../events/events.js";
import { LiveReplicaServer } from '../server';
import { Replica } from '../replica/replica';
import LiveReplicaSocket from "../socket/socket.js";

function createBaseSocket() {
    const connection = new EventEmitter();
    connection.connect = jest.fn();
    connection.disconnect = jest.fn();
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

    it.todo('should notify replica when subscription is successful');
    it.todo('should notify replica when subscription is rejected');
    it.todo('should sync server with replica changes');
    it.todo('should sync replica with server changes');
    it.todo('test all operations with and without allowWrite')
    it.todo('reset')
    it.todo('subscribed')
    it.todo('synced')
});