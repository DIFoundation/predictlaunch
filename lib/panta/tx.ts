import { Connection, PublicKey, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
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

  // Solana reports AccountNotFound at fee-payer validation when the wallet account
  // does not exist on the RPC cluster. Panta writes are mainnet-only.
  const ownerInfo = await conn.getAccountInfo(owner, "confirmed");
  if (!ownerInfo) {
    const [lamports, genesisHash] = await Promise.all([
      conn.getBalance(owner, "confirmed").catch(() => 0),
      conn.getGenesisHash().catch(() => "unavailable"),
    ]);
    return {
      simulated: false,
      error: `Simulation failed: fee-payer wallet account is missing on the configured RPC (balance: ${lamports} lamports; genesis: ${genesisHash}). Check that NEXT_PUBLIC_SOLANA_NETWORK=mainnet and the RPC is Solana mainnet, and that this wallet has SOL for fees. Do not bypass simulation.`,
      spentUsdc: null,
    };
  }

  const preInfo = await conn.getAccountInfo(ata, "confirmed");
  const pre = preInfo ? tokenAmountFromData(preInfo.data) : BigInt(0);

  // Match the proven Meteora launch simulation path: compile the legacy message into a
  // VersionedTransaction and ask the RPC to replace the blockhash for a signature-free dry run.
  // This is simulation only; the original Panta transaction is still signed and sent unchanged.
  const simulationTx = tx instanceof VersionedTransaction
    ? tx
    : new VersionedTransaction(tx.compileMessage());
  const { value } = await conn.simulateTransaction(simulationTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [ata.toBase58()] },
  });

  if (value.err) {
    return {
      simulated: false,
      error: `Simulation failed: ${JSON.stringify(value.err)}${(value.logs ?? []).length ? "\n" + (value.logs ?? []).join("\n") : ""}`,
      spentUsdc: null,
      logs: (value.logs ?? []).slice(-20),
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

/** Build the legacy transaction recipe returned by Panta. */
export function buildPantaTransaction(build: unknown, expectedWallet: PublicKey): Transaction {
  if (!build || typeof build !== "object") throw new Error("Panta returned an invalid build response.");
  const value = build as { wallet?: unknown; recentBlockhash?: unknown; lastValidBlockHeight?: unknown; instructions?: unknown };
  if (value.wallet !== expectedWallet.toBase58()) throw new Error("Panta build wallet does not match the connected wallet. Refusing to continue.");
  if (typeof value.recentBlockhash !== "string" || !value.recentBlockhash) throw new Error("Panta build response has no recentBlockhash.");
  if (!Number.isSafeInteger(value.lastValidBlockHeight) || Number(value.lastValidBlockHeight) <= 0) throw new Error("Panta build response has an invalid lastValidBlockHeight.");
  if (!Array.isArray(value.instructions) || value.instructions.length === 0 || value.instructions.length > 20) throw new Error("Panta build response has an invalid instruction list.");
  const instructions = value.instructions.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== "object") throw new Error("Panta instruction " + (index + 1) + " is malformed.");
    const item = raw as { programId?: unknown; data?: unknown; accounts?: unknown };
    if (typeof item.programId !== "string" || typeof item.data !== "string" || !Array.isArray(item.accounts)) throw new Error("Panta instruction " + (index + 1) + " is malformed.");
    const programId = new PublicKey(item.programId);
    const keys = item.accounts.map((rawAccount: unknown) => {
      if (!rawAccount || typeof rawAccount !== "object") throw new Error("Panta instruction account is malformed.");
      const account = rawAccount as { pubkey?: unknown; isSigner?: unknown; isWritable?: unknown };
      if (typeof account.pubkey !== "string" || typeof account.isSigner !== "boolean" || typeof account.isWritable !== "boolean") throw new Error("Panta instruction account is malformed.");
      const pubkey = new PublicKey(account.pubkey);
      if (account.isSigner && !pubkey.equals(expectedWallet)) throw new Error("Panta build requires an unexpected additional signer. Refusing to sign.");
      return { pubkey, isSigner: account.isSigner, isWritable: account.isWritable };
    });
    const data = Buffer.from(item.data, "base64");
    if (data.toString("base64") !== item.data) throw new Error("Panta instruction " + (index + 1) + " has invalid base64 data.");
    return new TransactionInstruction({ programId, keys, data });
  });
  const tx = new Transaction({ feePayer: expectedWallet, blockhash: value.recentBlockhash, lastValidBlockHeight: Number(value.lastValidBlockHeight) });
  tx.add(...instructions);
  return tx;
}
