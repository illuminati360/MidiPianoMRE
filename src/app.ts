import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import MidiPlayer from 'midi-player-ts';
import MidiServer from './midiServer';

// Trial and error
const PIANO_SCALE = 0.22;
const KEY_SCALE = 8.495;

// Based on the piano model (Trial and error)
const INITIAL_X_POSITION = 4.795;
const INITIAL_Y_POSITION = 4.115;
const INITIAL_Z_POSITION = 1.91;

const BLACK_KEY_Y_OFFSET = 0.014 * KEY_SCALE; // Black key length x1
const BLACK_KEY_Z_OFFSET = 0.072 * KEY_SCALE; // White key length x3

// 1.5 mm
const KEY_SPACER = 0.0015 * KEY_SCALE;

// Numbers based on real key sizes (24 mm for white / 14 mm for black)
// Note that the length is large for key press rotation purposes (visual hack)
const WHITE_KEY_DIMENSIONS = { 
    x: 0.024 * KEY_SCALE, 
    y: 0.024 * KEY_SCALE, 
    z: 0.5   * KEY_SCALE 
};

const BLACK_KEY_DIMENSIONS = { 
    x: 0.014 * KEY_SCALE, 
    y: 0.014 * KEY_SCALE,
    z: 0.5   * KEY_SCALE 
};

/*   
*      (n) = Offset starting position
*
*      Black keys will have an offset starting position of the 
*      previous white key plus half the width of the white key.
*
*            (1) (2) (3)     (5) (6)
*             B   B   B       B   B
*       W   W   W   W   W   W   W   
*      (0) (1) (2) (3) (4) (5) (6)
*
*       [0, (n)] = White key
*       [1, (n)] = Black key
*/

const OCTAVE_LAYOUT = [
//  WHITE   WHITE   BLACK   WHITE   BLACK   WHITE   BLACK   WHITE    WHITE  BLACK   WHITE   BLACK
    [0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [0, 5], [1, 5], [0, 6], [1, 6]
];

// How far the keys will rotate down
const whiteKeyRotationDegrees = 3;
const blackKeyRotationDegrees = 1;

interface keyState 
{
    originalPosition: MRE.Vector3, 
    originalRotation: MRE.Quaternion, 
    played: Boolean, 
    rotated: Boolean,
    keyIsBlack: number
}

/**
 * The main class of this app. All the logic goes here.
 */
export default class Piano
{
    private MidiPlayer: MidiPlayer.Player;

    private assets: MRE.AssetContainer;

    private piano: MRE.Actor;
	
    //private note: { [key: string]: MRE.Sound };
    private keySounds: MRE.Sound[] = [];
    private keyActors: MRE.Actor[] = [];
    private keyState: keyState[] = [];

    private whiteKeyMaterial: MRE.Material;
    private blackKeyMaterial: MRE.Material;

    constructor(private context: MRE.Context, private MidiServer: MidiServer, private baseUrl: string)
    {
        this.assets = new MRE.AssetContainer(context);

        this.context.onStarted(() => this.init());
    }

    /**
     * Once the context is "started", initialize the app.
     */
    private async init()
    {
        this.loadSounds();
        await this.createPiano();
		this.createKeys();
        this.handleMidiServer();
        //this.handleMidiPlayer();
    }

    private loadSounds()
    {
        for (let i = 0; i < 88; i++)
        {
            this.keySounds.push(this.assets.createSound(`${i+21}`, { uri: `${this.baseUrl}/notes/${i+21}.ogg` }));
        }
    }

    private async createPiano()
    {
        this.piano = MRE.Actor.CreateFromGltf(this.assets,
        {
            uri: `${this.baseUrl}/model/piano.glb`,
            actor:
            {
                name: 'Piano',
                transform:
                {
                    local:
                    {
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: PIANO_SCALE, y: PIANO_SCALE, z: PIANO_SCALE },
                        rotation: { y: 180 }
                    }
                }
            }
        });

		return this.piano.created();
    }

    private createKeys()
    {
        this.whiteKeyMaterial = this.assets.createMaterial('whiteKey', 
        {
            color: MRE.Color3.White()
        });

        this.blackKeyMaterial = this.assets.createMaterial('blackKey', 
        {
            color: MRE.Color3.Black()
        });
        
		for (let key = 0; key < 88; key++) 
		{
            let octave = Math.floor(key / 12); 
            let firstKeyInOctave = (octave * 7);
            let noteInOctave = key % 12;

            let typeOfKey = OCTAVE_LAYOUT[noteInOctave][0];
            let keyOffsetPosition = OCTAVE_LAYOUT[noteInOctave][1];

            let offset = (firstKeyInOctave + keyOffsetPosition) * (WHITE_KEY_DIMENSIONS.x + KEY_SPACER);

            this.createKey(key, typeOfKey, offset);
		}
    }

    private createKey(key: number, keyIsBlack: number, offset: number)
    {
        let matId: MRE.Guid = this.whiteKeyMaterial.id;
        let demensions = WHITE_KEY_DIMENSIONS;

        let xOffset = INITIAL_X_POSITION - offset;
        let yOffset = INITIAL_Y_POSITION;
        let zOffset = INITIAL_Z_POSITION;

        if (keyIsBlack)
        {
            matId = this.blackKeyMaterial.id;
            demensions = BLACK_KEY_DIMENSIONS;

            xOffset = INITIAL_X_POSITION - (offset + (WHITE_KEY_DIMENSIONS.x / 2));
            yOffset = INITIAL_Y_POSITION + BLACK_KEY_Y_OFFSET;
            zOffset = INITIAL_Z_POSITION - BLACK_KEY_Z_OFFSET;
        }

        const actor = MRE.Actor.CreatePrimitive(this.assets,
        {
            definition:
            {
                shape: MRE.PrimitiveShape.Box,
                dimensions: demensions
            },
            addCollider: true,
            actor:
            {
                name: `key-${key+21}-`,
                parentId: this.piano.id,
                appearance:
                {
                    materialId: matId
                },
                transform:
                {
                    local:
                    {
                        position: { x: xOffset, y: yOffset, z: zOffset}
                    }
                }
            },
        });

        this.keyActors.push(actor);

        this.keyState.push(
        { 
            originalPosition: new MRE.Vector3().copyFrom(actor.transform.local.position), 
            originalRotation: new MRE.Quaternion().copyFrom(actor.transform.local.rotation), 
            played: false, 
            rotated: false,
            keyIsBlack: keyIsBlack
        });

        const keyBehavior = actor.setBehavior(MRE.ButtonBehavior);

        keyBehavior.onClick(() =>
        {
            this.noteOn(key, 127);

            setTimeout(() => {
                this.noteOff(key);
              }, 500);
        });
    }

    private handleMidiServer()
    {
        this.MidiServer.on('noteOn', (data) =>
        {
            let note = data.note;
            let velocity = data.velocity as number / 127;

            this.noteOn(note, velocity);
        });

        this.MidiServer.on('noteOff', (data) =>
        {
            let note = data.note;

            this.noteOff(note);
        });

    }

    private handleMidiPlayer()
    {
        this.MidiPlayer = new MidiPlayer.Player().loadFile(`${this.baseUrl}/hes_a_pirate.mid`);

        this.MidiPlayer.on('midiEvent', (event: any) =>
        { 
            if (event.name === 'Note on' && event.velocity > 0)
            {
                this.noteOn(event.noteNumber-21, event.velocity);
            }
            else if (event.name === 'Note off' || event.velocity <= 0)
            {
                this.noteOff(event.noteNumber-21);
            }
        });
    }

    private noteOn(keyIndex: number, velocity: number)
    {
        const instance = this.piano.startSound(this.keySounds[keyIndex].id,
        {
            doppler: 0.0, 
            volume: velocity
        });
        
        if (!this.keyState[keyIndex].rotated)
        {
            this.rotateKeyDown(keyIndex);
        }
    }

    private noteOff(keyIndex: number)
    {
        if (this.keyState[keyIndex].rotated)
        {
            this.rotateKeyUp(keyIndex);
        }
    }

    private rotateKeyDown(keyIndex: number)
    {
        let amountToRotate = whiteKeyRotationDegrees * Math.PI / 180;

        if (this.keyState[keyIndex].keyIsBlack)
        {
            amountToRotate = blackKeyRotationDegrees * Math.PI / 180;
        }

        let keyRotation = { transform: { local: { rotation: MRE.Quaternion.RotationYawPitchRoll(0, amountToRotate, 0) } } };
        this.keyActors[keyIndex].animateTo(keyRotation, 0.01, MRE.AnimationEaseCurves.Linear);
        this.keyState[keyIndex].rotated = !this.keyState[keyIndex].rotated;
    }

    private rotateKeyUp(keyIndex: number)
    {
        let keyRotation = { transform: { local: { rotation: this.keyState[keyIndex].originalRotation } } };
        this.keyActors[keyIndex].animateTo(keyRotation, 0.01, MRE.AnimationEaseCurves.Linear);
        this.keyState[keyIndex].rotated = !this.keyState[keyIndex].rotated;
    }
}