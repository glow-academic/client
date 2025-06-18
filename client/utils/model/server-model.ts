// utils/model.ts
// Utility functions for models - Server Actions
// @AshokSaravanan222 & @siladiea
// 06/18/2025
"use server";

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

// Generate a key from the secret using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

export const encryptProviderKey = async (
  providerKey: string
): Promise<string> => {
  const secretKey = process.env["SECRET_KEY"];
  if (!secretKey) {
    throw new Error("SECRET_KEY environment variable is not set");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(secretKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(providerKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Combine salt + iv + encrypted data
  const combined = Buffer.concat([salt, iv, Buffer.from(encrypted, "hex")]);

  return combined.toString("base64");
};

export const decryptProviderKey = async (
  encryptedKey: string
): Promise<string> => {
  const secretKey = process.env["SECRET_KEY"];
  if (!secretKey) {
    throw new Error("SECRET_KEY environment variable is not set");
  }

  const combined = Buffer.from(encryptedKey, "base64");

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH);

  const key = deriveKey(secretKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};
