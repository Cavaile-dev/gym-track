import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test from 'node:test'
import { createSetWriter } from './requests.js'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const payload = { exerciseId: 1, weight: 40, reps: 10 }

function withoutRandomUUID(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: array => webcrypto.getRandomValues(array) },
  })
  t.after(() => Object.defineProperty(globalThis, 'crypto', original))
}

test('logging the first set works when crypto.randomUUID is unavailable', async t => {
  withoutRandomUUID(t)
  const sent = []
  const writer = createSetWriter(async body => {
    sent.push(body)
    return { logs: [body] }
  })

  const result = await writer.submit(payload)

  assert.equal(sent.length, 1)
  assert.match(sent[0].requestId, uuidV4)
  assert.deepEqual(result.logs, sent)
  assert.equal(writer.pending, null)
})

test('retrying a set keeps its ID without crypto.randomUUID', async t => {
  withoutRandomUUID(t)
  const sent = []
  const writer = createSetWriter(async body => {
    sent.push(body)
    if (sent.length === 1) throw new Error('Connection lost')
    return { logs: [body] }
  })

  await assert.rejects(() => writer.submit(payload), /Connection lost/)
  assert.ok(writer.pending)
  await writer.submit(payload)

  assert.equal(sent.length, 2)
  assert.match(sent[0].requestId, uuidV4)
  assert.equal(sent[0].requestId, sent[1].requestId)
  assert.equal(writer.pending, null)
})

test('different completed sets receive different IDs without crypto.randomUUID', async t => {
  withoutRandomUUID(t)
  const ids = []
  const writer = createSetWriter(async body => {
    ids.push(body.requestId)
    return { logs: [] }
  })

  await writer.submit(payload)
  await writer.submit(payload)

  assert.match(ids[0], uuidV4)
  assert.match(ids[1], uuidV4)
  assert.notEqual(ids[0], ids[1])
})

test('fallback sets UUID version and variant bits', async t => {
  withoutRandomUUID(t)
  globalThis.crypto.getRandomValues = bytes => bytes.fill(0xff)
  const writer = createSetWriter(async body => body)

  const result = await writer.submit(payload)

  assert.equal(result.requestId, 'ffffffff-ffff-4fff-bfff-ffffffffffff')
})

test('native randomUUID is used when available', async t => {
  withoutRandomUUID(t)
  const expected = '12345678-1234-4234-8234-123456789abc'
  globalThis.crypto.randomUUID = function () {
    assert.equal(this, globalThis.crypto)
    return expected
  }
  globalThis.crypto.getRandomValues = () => assert.fail('Native UUID should be used')
  const writer = createSetWriter(async body => body)

  const result = await writer.submit(payload)

  assert.equal(result.requestId, expected)
})
