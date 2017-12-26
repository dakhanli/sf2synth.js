import { parseRiff, Chunk } from "./RiffParser.ts"
import { PresetHeader, Sample, PresetBag, Instrument, InstrumentBag, ModulatorList, GeneratorList } from "./Structs.ts"
import { readString } from "./readString.ts"
import Stream from "./Stream.ts"
import { InfoNameTable } from "./Constants.ts"

export interface SampleHeader {
  sampleRate: number
  sampleName: number
  pitchCorrection: number
  startLoop: number
  endLoop: number
  originalPitch: number
}

export interface InstrumentZone {
  instrumentGeneratorIndex: number
  instrumentModulatorIndex: number
  presetModulatorIndex: number
}

export default class {
  input: Uint8Array
  parserOption: {} | undefined
  presetHeader: {}[]
  presetZone: {}[]
  presetZoneModulator: {}[]
  presetZoneGenerator: {}[]
  instrument: { instrumentName: string, instrumentBagIndex: number }[]
  instrumentZone: InstrumentZone[]
  instrumentZoneModulator: {}[]
  instrumentZoneGenerator: {}[]
  sampleHeader: SampleHeader[]
  sample: Int16Array[]
  samplingData: Chunk
  info: {}

  constructor(input: Uint8Array, opt_params: { parserOption?: {} } = {}) {
    this.input = input
    this.parserOption = opt_params.parserOption
  }

  parse() {
    // parse RIFF chunk
    const chunkList = parseRiff(this.input, 0, this.input.length, this.parserOption)

    if (chunkList.length !== 1) {
      throw new Error('wrong chunk length')
    }

    const chunk = chunkList[0]
    if (chunk === null) {
      throw new Error('chunk not found')
    }

    this.parseRiffChunk(chunk, this.input)
    this.input = null
  }

  parseRiffChunk(chunk: Chunk, data: Uint8Array) {
    const chunkList = getChunkList(chunk, data, "RIFF", "sfbk")

    if (chunkList.length !== 3) {
      throw new Error('invalid sfbk structure')
    }

    // INFO-list
    this.info = parseInfoList(chunkList[0], data)

    // sdta-list
    this.samplingData = parseSdtaList(chunkList[1], data)

    // pdta-list
    this.parsePdtaList(chunkList[2], data)
  }

  parsePdtaList(chunk: Chunk, data: Uint8Array) {
    const chunkList = getChunkList(chunk, data, "LIST", "pdta")

    // check number of chunks
    if (chunkList.length !== 9) {
      throw new Error('invalid pdta chunk')
    }

    this.presetHeader = parsePhdr(chunkList[0], data)
    this.presetZone = parsePbag(chunkList[1], data)
    this.presetZoneModulator = parsePmod(chunkList[2], data)
    this.presetZoneGenerator = parsePgen(chunkList[3], data)
    this.instrument = parseInst(chunkList[4], data) as any
    this.instrumentZone = parseIbag(chunkList[5], data) as InstrumentZone[]
    this.instrumentZoneModulator = parseImod(chunkList[6], data)
    this.instrumentZoneGenerator = parseIgen(chunkList[7], data)
    this.sampleHeader = parseShdr(chunkList[8], data) as SampleHeader[]
    this.sample = loadSample(this.sampleHeader, this.samplingData.offset, data)
  }
}

function getChunkList(chunk, data, expectedType, expectedSignature) {
  // check parse target
  if (chunk.type !== expectedType) {
    throw new Error('invalid chunk type:' + chunk.type)
  }

  const stream = new Stream(data, chunk.offset)

  // check signature
  const signature = stream.readString(4)
  if (signature !== expectedSignature) {
    throw new Error('invalid signature:' + signature)
  }

  // read structure
  return parseRiff(data, stream.ip, chunk.size - 4)
}

function parseInfoList(chunk: Chunk, data: Uint8Array): {} {
  const info = {}
  const chunkList = getChunkList(chunk, data, "LIST", "INFO")

  for (let p of chunkList) {
    const { offset, size, type } = p
    const name = InfoNameTable[type] || type
    info[name] = readString(data, offset, offset + size)
  }

  return info
}

function parseSdtaList(chunk: Chunk, data: Uint8Array): Chunk {
  const chunkList = getChunkList(chunk, data, "LIST", "sdta")

  if (chunkList.length !== 1) {
    throw new Error('TODO')
  }

  return chunkList[0]
}

function parseChunk(chunk: Chunk, data: Uint8Array, type: string, factory): {}[] {
  const result = []

  if (chunk.type !== type) {
    throw new Error('invalid chunk type:'  + chunk.type)
  }
  
  const stream = new Stream(data, chunk.offset)
  const size = chunk.offset + chunk.size
  
  while (stream.ip < size) {
    result.push(factory(stream))
  }

  return result
}

const parsePhdr = (chunk, data) => parseChunk(chunk, data, "phdr", stream => PresetHeader.parse(stream))
const parsePbag = (chunk, data) => parseChunk(chunk, data, "pbag", stream => PresetBag.parse(stream))
const parseInst = (chunk, data) => parseChunk(chunk, data, "inst", stream => Instrument.parse(stream))
const parseIbag = (chunk, data) => parseChunk(chunk, data, "ibag", stream => InstrumentBag.parse(stream))
const parsePmod = (chunk, data) => parseChunk(chunk, data, "pmod", stream => ModulatorList.parse(stream))
const parseImod = (chunk, data) => parseChunk(chunk, data, "imod", stream => ModulatorList.parse(stream))
const parsePgen = (chunk, data) => parseChunk(chunk, data, "pgen", stream => GeneratorList.parse(stream))
const parseIgen = (chunk, data) => parseChunk(chunk, data, "igen", stream => GeneratorList.parse(stream))
const parseShdr = (chunk, data) => parseChunk(chunk, data, "shdr", stream => Sample.parse(stream))

function adjustSampleData(sample, sampleRate) {
  let multiply = 1

  // buffer
  while (sampleRate < 22050) {
    const newSample = new Int16Array(sample.length * 2)
    for (let i = 0, j = 0, il = sample.length; i < il; ++i) {
      newSample[j++] = sample[i]
      newSample[j++] = sample[i]
    }
    sample = newSample
    multiply *= 2
    sampleRate *= 2
  }

  return {
    sample,
    multiply
  }
}

function loadSample(sampleHeader, samplingDataOffset, data): Int16Array[] {
  const samples = []
  for (let header of sampleHeader) {
    let sample = new Int16Array(new Uint8Array(data.subarray(
      samplingDataOffset + header.start * 2,
      samplingDataOffset + header.end   * 2
    )).buffer)
    if (header.sampleRate > 0) {
      const adjust = adjustSampleData(sample, header.sampleRate)
      sample = adjust.sample
      header.sampleRate *= adjust.multiply
      header.startLoop *= adjust.multiply
      header.endLoop *= adjust.multiply
    }
    samples.push(sample)
  }
  return samples
}