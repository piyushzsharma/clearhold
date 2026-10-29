import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

type EncryptedPart = { version: 2; iv: string; ciphertext: string; authTag: string }

function masterKey(): Buffer {
  const value = process.env.MASTER_KEY
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('MASTER_KEY must be exactly 64 hexadecimal characters')
  }
  return Buffer.from(value, 'hex')
}

function context(escrowId: string, purpose: 'credential' | 'dek'): Buffer {
  if (!escrowId || typeof escrowId !== 'string') throw new Error('Escrow ID is required')
  return Buffer.from(`clearhold:v2:${purpose}:${escrowId}`, 'utf8')
}

function encrypt(data: Buffer, key: Buffer, aad: Buffer): EncryptedPart {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])
  return {
    version: 2,
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  }
}

function parsePart(json: string): EncryptedPart {
  let part: unknown
  try { part = JSON.parse(json) } catch { throw new Error('Invalid credential envelope') }
  if (!part || typeof part !== 'object') throw new Error('Invalid credential envelope')
  const value = part as Partial<EncryptedPart>
  if (value.version !== 2 || typeof value.iv !== 'string' || !/^[0-9a-fA-F]{24}$/.test(value.iv) ||
      typeof value.authTag !== 'string' || !/^[0-9a-fA-F]{32}$/.test(value.authTag) ||
      typeof value.ciphertext !== 'string' || !/^(?:[0-9a-fA-F]{2})*$/.test(value.ciphertext)) {
    throw new Error('Invalid credential envelope')
  }
  return value as EncryptedPart
}

function decrypt(json: string, key: Buffer, aad: Buffer): Buffer {
  const part = parsePart(json)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(part.iv, 'hex'), { authTagLength: 16 })
  decipher.setAAD(aad)
  decipher.setAuthTag(Buffer.from(part.authTag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(part.ciphertext, 'hex')), decipher.final()])
}

// The DEK is unique to this submission. Both GCM tags bind the envelope to its escrow ID.
export function envelopeEncrypt(credentialsPlaintext: string, escrowId: string) {
  const key = masterKey()
  const dek = randomBytes(32)
  try {
    const encryptedCredentials = encrypt(Buffer.from(credentialsPlaintext, 'utf8'), dek, context(escrowId, 'credential'))
    const wrappedCredentialKey = encrypt(dek, key, context(escrowId, 'dek'))
    return {
      encryptedCredentials: JSON.stringify(encryptedCredentials),
      wrappedCredentialKey: JSON.stringify(wrappedCredentialKey),
    }
  } finally {
    dek.fill(0)
    key.fill(0)
  }
}

export function envelopeDecrypt(encryptedCredentials: string, wrappedCredentialKey: string | null, escrowId: string): string {
  if (!wrappedCredentialKey) throw new Error('Credential key is unavailable')
  const key = masterKey()
  let dek: Buffer | undefined
  try {
    dek = decrypt(wrappedCredentialKey, key, context(escrowId, 'dek'))
    if (dek.length !== 32) throw new Error('Invalid credential key')
    return decrypt(encryptedCredentials, dek, context(escrowId, 'credential')).toString('utf8')
  } finally {
    dek?.fill(0)
    key.fill(0)
  }
}
