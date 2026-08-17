import { startTestOpa, type TestOpa } from "./support/opa";

let opa: TestOpa;

/**
 * Ein Behaelter fuer den gesamten Lauf. Anders als die Datenbank traegt OPA keinen
 * Zustand, den ein Test veraendert - die Richtlinien liegen fest. Ein Behaelter je
 * Datei waere derselbe Aufbau, nur oefter.
 */
export async function setup(): Promise<void> {
  opa = await startTestOpa();
  process.env["OPA_URL"] = opa.url;
}

export async function teardown(): Promise<void> {
  await opa?.stop();
}
