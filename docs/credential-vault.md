# Credential vault (Phase 7)

The seller sends plaintext credentials over the authenticated application request. The backend generates a fresh 256-bit data-encryption key (DEK) for that submission and encrypts the UTF-8 credentials with AES-256-GCM. It wraps the DEK separately with the configured 256-bit master key, also using AES-256-GCM. Each operation uses its own random 96-bit nonce and stores its 128-bit authentication tag. Version 2 envelopes bind both layers to the escrow ID through separate authenticated additional data (AAD) contexts.

`MASTER_KEY` must be exactly 64 hexadecimal characters. Missing or malformed configuration fails closed; the app never invents a replacement key. Keep one stable key across application instances and restarts. A lost or changed master key makes existing credentials unreadable. The current project uses an environment secret, not a KMS, HSM, or automatic rotation system.

The buyer can request decryption only while the escrow is in `VERIFICATION_WINDOW` and before its deadline. The read locks the escrow row while it decrypts and writes an access event, so a concurrent settlement cannot delete the wrapped key in the middle of that operation. The HTTP response requests `no-store` caching. It still delivers plaintext to the authorized buyer's browser, where screenshots, browser extensions, or a compromised endpoint are outside the vault's control.

Terminal escrow transitions delete `wrappedCredentialKey` in the same PostgreSQL transaction as settlement. The ciphertext can remain for audit, but without that DEK wrapper the application cannot decrypt it. This is application-level key deletion, not an absolute guarantee that every historical copy is gone: database backups, replicas, memory, or previous access may still contain the key or plaintext. Backup retention and key destruction need an operational policy before claiming irreversible cryptographic shredding.

The old unversioned envelopes are rejected rather than silently treated as version 2. Before upgrading a database with active historical credentials, inventory and migrate them through a controlled re-encryption procedure while the old master key is available. The local development database has no such historical escrow data.

Focused tests cover round trips, fresh keys/nonces, cross-escrow copying, envelope swapping, tampering, missing/wrong master keys, and missing wrappers. The state-machine PostgreSQL suite covers terminal wrapper deletion. These tests do not establish KMS-grade key management or production recovery behavior.
