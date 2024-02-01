# live-replica
Efficient real-time state syncing

Live Replica provides magic like state syncing, 
allowing client replicas to subscribe to an entire hierarchical data structures or a subset (using jsonpath like syntax) on the server memory.

Upon successful subscription, the client replica receives a complete snapshot and then kept in sync with the server state in real-time.
For updates only the delta required for the subscribed part to be up-to-date is sent over the transport.

(documentation is still work in progress)

## Features
- Real-time and efficient state syncing using a diff algorithm
- Powerful observability features on both client and server
- Bi-directional syncing (client replica's can also update the server state)
- RPC (Remote Procedure Call) support whenever the server state contains functions 
- Multiple server and transport implementations
    - WebSocket and Socket.io for browser and node.js
    - Worker postMessage for WebWorker / SharedWorker (server) and main thread syncing inside the browser
    - IPC for state syncing between node.js processes in a cluster configuration
- Offers both OOP and functional style apis 
- Data mutations can be done either explicitly via api calls or simply manipulating javascript proxies
- Server side access control via a middlewares
- First party [LitElement / LitHtml](https://lit.dev) integration

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
### Client (Browser)

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


## Lit integration

Live Replica offers 3 options for lit integration that allows you to use the `live-replica`
 - [ReactiveController](https://lit.dev/docs/composition/controllers/) - Enables you to bind a replica to a LitElement life cycle to update the element on state changes
 - @observed State / Property decorator - Enables you to bind a replica or any object as an observed @property or @state of a LitElement, this uses the reactive controller under the hood,
 - Live Directive - This is a lit-html [AsyncDirective](https://lit.dev/docs/templates/custom-directives/#async-directives) that enables you to bind a specific replica part by path to a template part which asynchronously updates the template part on state changes without re-rendering the entire template

### @observed State / Property decorator
Enables you to bind a replica or any object as an observed @property or @state of a LitElement, this uses the reactive controller under the hood,

```typescript
import { LitElement, html } from 'lit-element';
import { LiveReplica, connect } from '@live-replica/live-replica';
import { observed } from '@live-replica/lit';


class MyElement extends LitElement {
        
    // this will have the same effect as the LiveReplicaController example below, it will update the element on state changes and unwatch on disconnectedCallback
    @observed() @state() myState = LiveReplica.create();

    constructor() {
        super();
        connect(this.myState, socket, 'server.path');
    }

    render() {
        return html`${myState?.some?.path?.inside}`;
    }
}
```

### ReactiveController
If you are not using typescript or needs more control over the watch mechanism you can use
LiveReplicaController which is a [ReactiveController](https://lit.dev/docs/composition/controllers/) that enables you to bind a replica to a LitElement life cycle to update the element on state changes

```typescript
import { LitElement, html } from 'lit-element';
import { LiveReplica } from '@live-replica/live-replica';
import { LiveReplicaController } from '@live-replica/lit';

class MyElement extends LitElement {
    
    constructor() {
        super();

        const client = new LiveReplica.WebSocketClient('ws://localhost:8080');
        client.connect();
  
  
        const replica = new LiveReplica.Replica();
        replica.connect(client, 'foo');
        
        const lrController = new LiveReplicaController(this);

        
        lrController.watch(replica); // updates element on replica state changes and unwatch on disconnectedCallback

        lrController.watch(replica, 'some.path.inside'); // updates element only when anything inside 'some.path.inside' changes and unwatch on disconnectedCallback
        // optionally include a watch callback to be called on state changes
        lrController.watch(replica, (replica) => {
            console.log(replica.data);
        });
        
        // it is very likley that you will 
    }

    render() {
        return html`
            <live-replica .replica=${this.replica}></live-replica>
        `;
    }
}
```

[![Build Status](https://travis-ci.org/barakedry/live-replica.svg?branch=master)](https://travis-ci.org/barakedry/live-replica)
[![Coverage Status](https://coveralls.io/repos/github/barakedry/live-replica/badge.svg?branch=master)](https://coveralls.io/github/barakedry/live-replica?branch=master)
[![npm version](https://badge.fury.io/js/live-replica.svg)](https://badge.fury.io/js/live-replica)


## License
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/barakedry/live-replica/blob/master/LICENSE)

Apache 2.0 - see [LICENSE](https://github.com/barakedry/live-replica/blob/master/LICENSE)
