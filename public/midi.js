var MidiPiano = MidiPiano || {};

(function(exports) 
{ 'use strict';

	function initalizeMidiInput()
	{
		console.log("Initializing MIDI Input");
		
		// request MIDI access
		if (navigator.requestMIDIAccess) 
		{
			navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess);
		}
		else 
		{
			console.log("MIDI device failed to connect!");
		}
		
		var data, cmd, channel, type, note, velocity;

		function onMIDISuccess(midiAccess) 
		{
			var midi = midiAccess;
			var inputs = midi.inputs.values();

			for (var input = inputs.next(); input && !input.done; input = inputs.next())
			{
				input.value.onmidimessage = onMIDIMessage;

				var output = "Midi Connected! Device: " + input.value.name;
				document.getElementById('details').innerHTML = output;
			}

			midi.onstatechange = onStateChange;
		}

		function onMIDIMessage(event) 
		{
			data = event.data,
			cmd = data[0] >> 4,
			channel = data[0] & 0xf,
			type = data[0] & 0xf0,
			note = data[1],
			velocity = data[2];

			switch (type) 
			{
				case 144: // noteOn message 
						//some midi devices set velocity to 0 instead of broadcasting 128.
						if (velocity == 0) { Client.send('noteOff', {note: note-21, velocity: 0});}
						else { Client.send('noteOn', {note: note-21, velocity: velocity}); }
						break;

				case 128: // noteOff message 
					Client.send('noteOff', {note: note-21, velocity: 0});
					break;
			}
		}

		function onStateChange(event) 
		{
			var port = event.port,
				state = port.state,
				name = port.name,
				type = port.type;

			if (type == "input") console.log("name", name, "port", port, "state", state);
			
			if (state == "disconnected")
			{
				var output = "MIDI device disconnected! Refresh page to reconnect.";
				document.getElementById('details').innerHTML = output;
			}
		}
	}

	function start(config)
	{
		initalizeMidiInput();

		Client.connect(config);
	}

	exports.start = start;

})(MidiPiano);