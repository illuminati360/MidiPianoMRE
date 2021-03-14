/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { log, WebHost } from '@microsoft/mixed-reality-extension-sdk';
import { resolve as resolvePath } from 'path';
import { Websocket as MidiServer }  from './midi-server';
import Piano from './app';

process.on('uncaughtException', (err) => console.log('uncaughtException', err));
process.on('unhandledRejection', (reason) => console.log('unhandledRejection', reason));

 // Start listening for connections, and serve static files
const server = new WebHost({
   baseDir: resolvePath(__dirname, '../public')
});

const midiServer = new MidiServer(8888);

// Handle new application sessions
server.adapter.onConnection(context => new Piano(context, midiServer, server.baseUrl ));