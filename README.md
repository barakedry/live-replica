# live-replica
Efficient real-time state syncing

## Installation
```bash
npm install live-replica
```

## Usage

### Server (Node.js) 
```typescript
import { LiveReplica } from '@live-replica/live-replica';
import ws from 'ws';

const server = new LiveReplica.WebSocketServer(ws);
server.listen(8080);

server.set('foo', { bar: 'baz' });

```
### Client 

#### Creating a replica
```typescript
import { LiveReplica } from '@live-replica/live-replica';

const client = new LiveReplica.WebSocketClient('ws://localhost:8080');
client.connect();


const replica = new LiveReplica.Replica();
await replica.connect(client, 'foo');



```

### Functional style and proxies
Live Replica offers a functional style api as an alternative to the OOP style or even mixing the 2 styles together. 

It works by utilizing javascript proxies that can be manipulated just like a regular object.
This offers a more intuitive way to work and manipulate the state and is more suitable for functional programming.

Obtaining a proxy can be done by either accessing the `data` property a replica or
by using the `Replica.create` factory function to create proxy to a new replica (implicit replica creation is done behind the scenes)

#### Obtaining a proxy via an existing replica
```typescript
import { LiveReplica } from '@live-replica/live-replica';

// obtaining a proxy from an existing replica
const replica = new LiveReplica.Replica();
const dataProxy = replica.data;
```

#### Obtaining a proxy via the `create` function
```typescript
// obtaining a proxy from a new replica
const dataProxy = LiveReplica.create();
```

#### Connecting to a server with data proxies
If the proxy is obtained from an existing replica, 
connecting to a server can be done by calling the `replica.connect()` method on the replica,

however, If the proxy is obtained from `Replica.create` and don't have access to the replica you can use the `connect()` function to achieve the same result. 

example:
```typescript

await connect(dataProxy, socket, 'foo');

// read
console.log(dataProxy.foo) // returns { bar: 'baz' }

```



For transactional mutations  it follows the lodash style of functions such as merge, set, get 
supplying the proxy as the first argument and the path as the second argument


```typescript

    const dataProxy = LiveReplica.create({
        foo: {
            bar: 'baz'
        }
    });

    get(dataProxy, 'foo.bar'); // returns 'baz'
    
    set(dataProxy, 'foo.bar', 'qux'); // sets 'qux' to 'foo.bar'
    
    merge(dataProxy, 'foo', { bar: 'qux' }); // merges { bar: 'qux' } to 'foo'

```



[![Build Status](https://travis-ci.org/barakedry/live-replica.svg?branch=master)](https://travis-ci.org/barakedry/live-replica)
[![Coverage Status](https://coveralls.io/repos/github/barakedry/live-replica/badge.svg?branch=master)](https://coveralls.io/github/barakedry/live-replica?branch=master)
[![npm version](https://badge.fury.io/js/live-replica.svg)](https://badge.fury.io/js/live-replica)


Work in progress

## License
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/barakedry/live-replica/blob/master/LICENSE)

Apache 2.0 - see [LICENSE](https://github.com/barakedry/live-replica/blob/master/LICENSE)
