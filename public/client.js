var Client = Client || {};

(function(exports) 
{ 'use strict';

	/*
		CONNECTING	0	The connection is not yet open.
		OPEN		1	The connection is open and ready to communicate.
		CLOSING		2	The connection is in the process of closing.
		CLOSED		3	The connection is closed or couldn't be opened.
	*/		
	var Status = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
	
	var ws;
	var eventFunctions = {};
	var prePackets = [];
	var status = Status[0];
	
	function connect(config, callback)
	{	
		if (status === 'OPEN') { return; } // We only want to use one instance of WebSocket
		
		var config = config || {};
		var host = config.host || 'localhost';
		var port = config.port;
		var protocol = 'wss://';

		if (!host) { console.log('A valid url must be provided to connect to server!'); return; } //Host must be provided

		if (port)
		{
			host = host + ':' + port;
		}

		if (host.includes('localhost') || host.includes('127.0.0.1'))
		{
			protocol = 'ws://';
			host = host + ':8080';
		}

		ws = new WebSocket(protocol + host);
		
		ws.onopen = function (event)
		{
			status = Status[ws.readyState];

			if (prePackets.length > 0)
			{
				for (var i = 0; i < prePackets.length; i++)
				{
					sendPacket(prePackets[i]);
				}
			}
			
			if (callback)
				callback();
		};
		
		ws.onmessage = function (message)
		{
			var packet = JSON.parse(message.data);
			
			var event = packet.event;
			var data = packet.data;
			
			eventFunctions[event](data);
		};	
	}
	
	function sendPacket(packet)
	{
		if (status === 'OPEN')
		{
			ws.send(packet, function(error) { console.log(error) });
		}
		else if (status === 'CONNECTING')
		{
			prePackets.push(packet);
		}
	}	
	
	function registerEvent(event, func)
	{
		eventFunctions[event] = func;		
	}
	
	function send(event, data)
	{
		var data = data || '';
		var packet = JSON.stringify( {event: event, data: data} );
		
		sendPacket(packet);
	}

	function on(event, func)
	{
		registerEvent(event, func);
	}
	
	exports.connect = connect;
	exports.send = send;
	exports.on = on;
	exports.status = status;

})(Client);