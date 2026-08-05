import { createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import jwt, { type SignOptions } from "jsonwebtoken";

export interface JwksTestServer {
  issuer: string;
  sign(payload: object, options?: SignOptions): string;
  signWithForeignKey(payload: object, options?: SignOptions): string;
  close(): Promise<void>;
}

const pemKeyPair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

/**
 * Stellt einen JWKS-Endpunkt mit einem im Testprozess erzeugten Schluesselpaar bereit.
 * Erlaubt Faelle, die sich mit echtem Keycloak nur umstaendlich erzeugen lassen:
 * abgelaufene Token, falsche Zielgruppe, fremder Aussteller, fremder Schluessel.
 */
export async function startJwksTestServer(): Promise<JwksTestServer> {
  const keyId = randomUUID();
  const trusted = pemKeyPair();
  const foreign = pemKeyPair();

  const jwk = {
    ...createPublicKey(trusted.publicKey).export({ format: "jwk" }),
    kid: keyId,
    use: "sig",
    alg: "RS256",
  };

  const server = createServer((req, res) => {
    if (req.url === "/protocol/openid-connect/certs") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;
  const issuer = `http://127.0.0.1:${port}`;

  const defaults: SignOptions = {
    algorithm: "RS256",
    keyid: keyId,
    issuer,
    audience: "requirement-api",
    expiresIn: "5m",
  };

  return {
    issuer,
    sign: (payload, options) => jwt.sign(payload, trusted.privateKey, { ...defaults, ...options }),
    signWithForeignKey: (payload, options) =>
      jwt.sign(payload, foreign.privateKey, { ...defaults, ...options }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
