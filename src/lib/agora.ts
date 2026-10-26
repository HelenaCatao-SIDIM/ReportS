import "server-only";
import { connection } from "next/server";

/** Hora atual do servidor, lida na requisição (nunca pré-renderizada). */
export async function horaDoServidor() {
  await connection();
  return Date.now();
}
