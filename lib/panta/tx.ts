import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_DECIMALS, USDC_MINT_MAINNET } from "@/lib/config/network";

/** Panta returns a base64 serialized unsigned tx; the field name isn't in the schema, so search for it. */
export function extractTxB64(build: unknown): string | null {
  if (!build || typeof build !== "object") return null;
  const o = build as Record<string, unknown>;
  const keys = ["transaction", "tx", "serializedTransaction", "txBase64", "transactionBase64", "unsignedTransaction", "unsignedTx"];
  for (const k of keys) {
    if (typeof o[k] === "string" && (o[k] as string).length > 100) return o[k] as string;
  }
  // One level of nesting, e.g. { data: { transaction } }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const inner = extractTxB64(v);
      if (inner) return inner;
    }
  }
  return null;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Deserialize FIRST, sign second, so a wallet rejection is never masked by a fallback. */
export function decodeTx(b64: string): VersionedTransaction | Transaction {
  const bytes = base64ToBytes(b64);
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

/** Token-account layout: amount is a little-endian u64 at offset 64. Returns raw units. */
export function tokenAmountFromData(data: Uint8Array): bigint {
  if (data.byteLength < 72) return BigInt(0);
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(64, true);
}

export interface UsdcSpend {
  /** false if the simulation itself failed (the tx would fail on-chain) */
  simulated: boolean;
  error?: string;
  /** USDC leaving the wallet (positive = spent). null when it could not be determined. */
  spentUsdc: number | null;
  logs?: string[];
}

/**
 * Independently measure what a transaction will do to the user's USDC balance, using the RPC
 * simulation. This is the safety net for the unverified Panta request bodies: whatever the API
 * "meant", we verify the real on-chain effect before the wallet is asked to sign.
 */
export async function simulateUsdcSpend(
  conn: Connection,
  tx: VersionedTransaction | Transaction,
  owner: PublicKey
): Promise<UsdcSpend> {
  const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT_MAINNET), owner);
  const vtx = tx instanceof VersionedTransaction ? tx : new VersionedTransaction(tx.compileMessage());

  const preInfo = await conn.getAccountInfo(ata);
  const pre = preInfo ? tokenAmountFromData(preInfo.data) : BigInt(0);

  const { value } = await conn.simulateTransaction(vtx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [ata.toBase58()] },
  });

  if (value.err) {
    return {
      simulated: false,
      error: `Simulation failed: ${JSON.stringify(value.err)}`,
      spentUsdc: null,
      logs: (value.logs ?? []).slice(-6),
    };
  }

  const acct = value.accounts?.[0];
  if (!acct) return { simulated: true, spentUsdc: null, logs: value.logs ?? undefined };

  const raw = acct.data as unknown as [string, string] | string;
  const b64 = Array.isArray(raw) ? raw[0] : raw;
  const post = tokenAmountFromData(base64ToBytes(b64));
  const spentRaw = pre - post;
  return { simulated: true, spentUsdc: Number(spentRaw) / 10 ** USDC_DECIMALS, logs: value.logs ?? undefined };
}

/** Wallet USDC balance in human units (0 if no USDC account). */
export async function usdcBalance(conn: Connection, owner: PublicKey): Promise<number> {
  const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT_MAINNET), owner);
  const info = await conn.getAccountInfo(ata);
  return info ? Number(tokenAmountFromData(info.data)) / 10 ** USDC_DECIMALS : 0;
}

/**
 * Decide whether a simulated spend is acceptable for what the user asked to spend.
 * Allows a small tolerance for rounding/fees.
 */
export function checkSpend(
  spent: number | null,
  asked: number
): { ok: true; note: string } | { ok: false; reason: string } | { ok: "unverified"; reason: string } {
  if (spent === null) {
    return { ok: "unverified", reason: "Could not determine how much USDC this transaction spends." };
  }
  if (spent <= 0) {
    return { ok: "unverified", reason: "This transaction does not appear to spend USDC from your main USDC account." };
  }
  const tolerance = Math.max(0.05, asked * 0.02);
  if (spent > asked + tolerance) {
    return {
      ok: false,
      reason: `Refusing to sign: this transaction would spend ${spent.toFixed(2)} USDC but you asked to spend ${asked.toFixed(2)} USDC.`,
    };
  }
  return { ok: true, note: `Verified by simulation: spends ${spent.toFixed(2)} USDC.` };
}
