export interface Listener {
  noteOn(channel: number, key: number, velocity: number)
  noteOff(channel: number, key: number, velocity: number)
  setMasterVolume(volume: number)
  programChange(channelNumber: number, instrument: number)
  volumeChange(channelNumber: number, volume: number)
  panpotChange(channelNumber: number, panpot: number)
  pitchBend(channelNumber: number, pitchBend: number)
  pitchBendSensitivity(channelNumber: number, sensitivity: number)
  allSoundOff(channelNumber: number)
  resetAllControl(channelNumber: number)
}

export default class MidiMessageHandler {
  private RpnMsb = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  private RpnLsb = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  listener: Listener

  processMidiMessage(message: number[]) {
    const channel = message[0] & 0x0f
    const { listener } = this

    if (!listener) {
      return
    }

    switch (message[0] & 0xf0) {
      case 0x80: // NoteOff: 8n kk vv
        listener.noteOff(channel, message[1], message[2])
        break
      case 0x90: // NoteOn: 9n kk vv
        if (message[2] > 0) {
          listener.noteOn(channel, message[1], message[2])
        } else {
          listener.noteOff(channel, message[1], 0)
        }
        break
      case 0xb0: // Control Change: Bn cc dd
        switch (message[1]) {
          case 0x06: // Data Entry: Bn 06 dd
            switch (this.RpnMsb[channel]) {
              case 0:
                switch (this.RpnLsb[channel]) {
                  case 0: // Pitch Bend Sensitivity
                    listener.pitchBendSensitivity(channel, message[2])
                    break
                  default:
                    break
                }
                break
              default:
                break
            }
            break
          case 0x07: // Volume Change: Bn 07 dd
            listener.volumeChange(channel, message[2])
            break
          case 0x0a: // Panpot Change: Bn 0A dd
            listener.panpotChange(channel, message[2])
            break
          case 0x78: // All Sound Off: Bn 78 00
            listener.allSoundOff(channel)
            break
          case 0x79: // Reset All Control: Bn 79 00
            listener.resetAllControl(channel)
            break
          case 0x20: // BankSelect
            //console.log("bankselect:", channel, message[2])
            break
          case 0x64: // RPN MSB
            this.RpnMsb[channel] = message[2]
            break
          case 0x65: // RPN LSB
            this.RpnLsb[channel] = message[2]
            break
          default:
          // not supported
        }
        break
      case 0xc0: // Program Change: Cn pp
        listener.programChange(channel, message[1])
        break
      case 0xe0: {
        // Pitch Bend
        const bend = (message[1] & 0x7f) | ((message[2] & 0x7f) << 7)
        listener.pitchBend(channel, bend)
        break
      }
      case 0xf0: // System Exclusive Message
        // ID number
        switch (message[1]) {
          case 0x7e: // non-realtime
            // TODO
            break
          case 0x7f: // realtime
            // const device = message[2]
            // sub ID 1
            switch (message[3]) {
              case 0x04: // device control
                // sub ID 2
                switch (message[4]) {
                  case 0x01: {
                    // master volume
                    const volume = message[5] + (message[6] << 7)
                    const MAX_VOLUME = 0x4000 - 1
                    listener.setMasterVolume(volume / MAX_VOLUME)
                    break
                  }
                  default:
                    break
                }
                break
              default:
                break
            }
            break
          default:
            break
        }
        break
      default:
        // not supported
        break
    }
  }
}
