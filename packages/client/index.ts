// @ts-nocheck
/**
 * This file is a TypeScript-compatible re-export of all components needed for client applications.
 * We're using @ts-nocheck because some of the imported modules don't have TypeScript declarations yet.
 */

// Import each module and add type declarations where needed
// We're using relative imports since these are all sibling packages

// Add type declarations for modules that don't have TypeScript definitions
declare module '../proxy/proxy.js';
declare module '../server/src/server.js';
declare module '../server/src/middlewares.js';
declare module '../worker-server/worker-server.js';
declare module '../shared-worker-server/shared-worker-server.js';
declare module '../worker-socket/worker-socket.js';
declare module '../message-channel-socket/message-channel-socket.js';
declare module '../socketio-client/socketio-client.js';

// Export everything from each module
export * from '@live-replica/patch-diff';
export * from '@live-replica/proxy';
export * from '@live-replica/replica';
export * from '@live-replica/ws-client';
// The following packages may not have TypeScript entry points, so keep as is or update as needed:
// export * from '@live-replica/server';
// export * from '@live-replica/worker-server';
// export * from '@live-replica/shared-worker-server';
// export * from '@live-replica/worker-socket';
// export * from '@live-replica/message-channel-socket';
// export * from '@live-replica/socketio-client'; 