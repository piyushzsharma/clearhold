import crypto from 'crypto';

// The Master Key is injected via env. In production, this would be an AWS KMS or GCP Cloud KMS call.
// For this portfolio project, we simulate KMS using a local AES-256-GCM master key.
const MASTER_KEY = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');

// Ensure the master key is exactly 32 bytes (256 bits)
const masterKeyBuffer = Buffer.from(MASTER_KEY.padStart(64, '0').slice(0, 64), 'hex');

/**
 * Encrypts data using AES-256-GCM.
 * Returns { ciphertext, iv, authTag } as hex strings.
 */
function encryptAES(dataBuffer, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  let ciphertext = cipher.update(dataBuffer);
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypts data using AES-256-GCM.
 */
function decryptAES(ciphertextHex, ivHex, authTagHex, keyBuffer) {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  
  return plaintext;
}

/**
 * Encrypts credentials using envelope encryption.
 * Generates a unique DEK, encrypts the credentials with the DEK, and wraps the DEK with the Master Key.
 */
export function envelopeEncrypt(credentialsPlaintext) {
  // 1. Generate a random Data Encryption Key (DEK)
  const dekBuffer = crypto.randomBytes(32);
  
  // 2. Encrypt credentials with DEK
  const encryptedCredentials = encryptAES(Buffer.from(credentialsPlaintext, 'utf-8'), dekBuffer);
  
  // 3. Encrypt (wrap) the DEK itself with the Master Key
  const wrappedDek = encryptAES(dekBuffer, masterKeyBuffer);
  
  return {
    encryptedCredentials: JSON.stringify(encryptedCredentials),
    wrappedCredentialKey: JSON.stringify(wrappedDek),
  };
}

/**
 * Decrypts credentials using envelope encryption.
 * Unwraps the DEK using the Master Key, then uses the DEK to decrypt the credentials.
 */
export function envelopeDecrypt(encryptedCredentialsJson, wrappedCredentialKeyJson) {
  if (!wrappedCredentialKeyJson) {
    throw new Error("Credential key has been cryptographically shredded or does not exist.");
  }
  
  const wrappedDek = JSON.parse(wrappedCredentialKeyJson);
  const encryptedCredentials = JSON.parse(encryptedCredentialsJson);
  
  // 1. Unwrap the DEK using Master Key
  const dekBuffer = decryptAES(wrappedDek.ciphertext, wrappedDek.iv, wrappedDek.authTag, masterKeyBuffer);
  
  // 2. Decrypt credentials with the unwrapped DEK
  const plaintextBuffer = decryptAES(
    encryptedCredentials.ciphertext, 
    encryptedCredentials.iv, 
    encryptedCredentials.authTag, 
    dekBuffer
  );
  
  return plaintextBuffer.toString('utf-8');
}
