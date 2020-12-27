import Synthesizer from "./Synthesizer"
import ProgramNames from "./ProgramNames"
import { Listener } from "./MidiMessageHandler"

function render(str: string): Element {
  const wrapper = document.createElement("div")
  wrapper.innerHTML = str.replace(/^\s+/, "")
  return wrapper.firstElementChild!
}

function renderKeys(): string {
  let html = ""
  for (let i = 0; i < 128; i++) {
    const n = i % 12
    const isBlack = [1, 3, 6, 8, 10].includes(n)
    html += `<div class="key ${isBlack ? "black" : "white"}"></div>`
  }
  return html
}

function renderProgramOptions(
  programNames: { [index: number]: string[] },
  bank: number
): string {
  let html = ""
  const names = programNames[bank]
  for (let i in names) {
    const name = names[i]
    html += `<option value="${i}">${i}: ${name}</option>`
  }
  return `<select>${html}</select>`
}

function renderInstrument(program): Element {
  return render(`
    <div class="instrument">
      <div class="program">${program}</div>
      <div class="volume"></div>
      <div class="panpot"></div>
      <div class="pitchBend"></div>
      <div class="pitchBendSensitivity"></div>
      <div class="keys">${renderKeys()}</div>
    </div>
  `)
}

function mergeProgramNames(
  left: { [index: number]: { [index: number]: string } },
  right: { [index: number]: { [index: number]: string } }
) {
  function mergedKeys(a, b) {
    return new Set([...Object.keys(a), ...Object.keys(b)])
  }
  const banks = mergedKeys(left, right)
  const result = {}
  banks.forEach(bank => {
    const l = left[bank] || []
    const r = right[bank] || []
    const list: { [index: number]: string} = {}
    const programs = mergedKeys(l, r)
    programs.forEach(p => {
      list[p] = `${l[p] || "None"} (${r[p] || "None"})`
    })
    result[bank] = list
  })
  return result
}

export default class View implements Listener {
  private element: Element|null
  private drag: boolean = false

  draw(synth: Synthesizer): Element {
    const element = this.element = render(`<div />`)
    const programNames = mergeProgramNames(programNamesFromBankSet(synth.soundFont.getPresetNames()), ProgramNames)

    for (let i = 0; i < 16; ++i) {
      const bank = i !== 9 ? 0 : 128
      const program = renderProgramOptions(programNames, bank)
      const item = renderInstrument(program)

      const channel = i
      const select = item.querySelector('select')
      if (select) {
        select.addEventListener('change', event => {
          const target = event.target as HTMLSelectElement
          const program = parseInt(target.value, 10)
          this.programChange(channel, program)
          synth.programChange(channel, program)
        }, false)
        select.selectedIndex = synth.channels[i].instrument
      }

      const notes = item.querySelectorAll(".key")
      for (let j = 0; j < 128; ++j) {
        const key = j

        notes[j].addEventListener('mousedown', event => {
          event.preventDefault()
          this.drag = true
          this.noteOn(channel, key, 127)
          synth.noteOn(channel, key, 127)

          const onMouseUp = event => {
            document.removeEventListener('mouseup', onMouseUp)
            event.preventDefault()
            this.drag = false
            this.noteOff(channel, key, 0)
            synth.noteOff(channel, key, 0)
          }
          
          document.addEventListener('mouseup', onMouseUp)
        })
        notes[j].addEventListener('mouseover', event => {
          event.preventDefault()
          if (this.drag) {
            this.noteOn(channel, key, 127)
            synth.noteOn(channel, key, 127)
          }
        })
        notes[j].addEventListener('mouseout', event => {
          event.preventDefault()
          this.noteOff(channel, key, 0)
          synth.noteOff(channel, key, 0)
        })
      }

      element.appendChild(item)
    }

    return element
  }

  remove() {
    if (!this.element) {
      return
    }

    this.element.parentNode!.removeChild(this.element)
    this.element = null
  }

  private getInstrumentElement(channel: number): Element|null {
    if (!this.element) {
      return null
    }
    return this.element.querySelectorAll(".instrument")[channel]
  }

  private getKeyElement(channel: number, key: number): Element|null {
    const elem = this.getInstrumentElement(channel)
    if (!elem) {
      return null
    }
    return elem.querySelectorAll(".key")[key]
  }

  private findInstrumentElement(channel: number, query: string): Element|null {
    const elem = this.getInstrumentElement(channel)
    if (!elem) {
      return null
    }
    return elem.querySelector(query)
  }

  noteOn(channel: number, key: number, _velocity: number) {
    const element = this.getKeyElement(channel, key)
    if (element) {
      element.classList.add('note-on')
    }
  }

  noteOff(channel: number, key: number, _velocity: number) {
    const element = this.getKeyElement(channel, key)
    if (element) {
      element.classList.remove('note-on')
    }
  }

  programChange(channel: number, instrument: number) {
    const select = this.findInstrumentElement(channel, ".program select") as HTMLSelectElement|undefined
    if (select) {
      select.value = `${instrument}`
    }
  }

  volumeChange(channel: number, volume: number) {
    const element = this.findInstrumentElement(channel, ".volume")
    if (element) {
      element.textContent = `${volume}`
    }
  }

  panpotChange(channel: number, panpot: number) {
    const element = this.findInstrumentElement(channel, ".panpot")
    if (element) {
      element.textContent = `${panpot}`
    }
  }

  pitchBend(channel: number, pitchBend: number) {
    const element = this.findInstrumentElement(channel, ".pitchBend")
    if (element) {
      element.textContent = `${pitchBend}`
    }
  }

  pitchBendSensitivity(channel: number, sensitivity: number) {
    const element = this.findInstrumentElement(channel, ".pitchBendSensitivity")
    if (element) {
      element.textContent = `${sensitivity}`
    }
  }

  allSoundOff(_channelNumber: number) {
  }

  setMasterVolume(_volume: number) {
  }

  resetAllControl(_channelNumber: number) {
  }
}
