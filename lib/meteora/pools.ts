import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * Live reads + swaps for Meteora Dynamic Bonding Curve pools.
 * Every number the UI shows comes from the chain through our RPC relay.
 * The SDK is imported lazily to keep it out of the initial bundle.
 */

const loadSdk = () => import("@meteora-ag/dynamic-bonding-curve-sdk");
const SOL_DECIMALS = 9;

export interface PoolView {
  pool: string;
  mint: string;
  config: string;
  creator: string;
  decimals: number;
  priceSol: number;
  marketCapSol: number;
  quoteReserveSol: number;
  migrationThresholdSol: number;
  /** 0..1 progress of the curve towards migration */
  progress: number;
  isMigrated: boolean;
  feeBps: number;
  name?: string;
  symbol?: string;
}

/** "1.5" + 6 decimals -> BN(1500000), without floating point. */
export function toRaw(amount: string, decimals: number): BN {
  const clean = amount.trim();
  if (!/^\d*\.?\d*$/.test(clean) || clean === "" || clean === ".") throw new Error("Enter a valid amount");
  const [whole, frac = ""] = clean.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return new BN((whole || "0") + padded);
}

export function fromRaw(raw: BN | string | number | bigint, decimals: number): number {
  const s = raw.toString();
  const neg = s.startsWith("-");
  const digits = (neg ? s.slice(1) : s).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  return Number(`${neg ? "-" : ""}${whole}.${frac || "0"}`);
}

// ---- Metaplex token metadata (name / symbol), parsed straight from the account ----

export function parseTokenMetadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  try {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let o = 1 + 32 + 32; // key + update authority + mint
    const dec = new TextDecoder();
    const readStr = () => {
      const len = dv.getUint32(o, true);
      o += 4;
      const s = dec.decode(data.subarray(o, o + len)).replace(/\0+$/g, "");
      o += len;
      return s;
    };
    return { name: readStr(), symbol: readStr(), uri: readStr() };
  } catch {
    return null;
  }
}

async function readMetadata(conn: Connection, mints: PublicKey[]) {
  const S = await loadSdk();
  const out = new Map<string, { name: string; symbol: string }>();
  const pdas = mints.map((m) => S.deriveMintMetadata(m));
  for (let i = 0; i < pdas.length; i += 90) {
    const infos = await conn.getMultipleAccountsInfo(pdas.slice(i, i + 90));
    infos.forEach((info, j) => {
      if (!info) return;
      const md = parseTokenMetadata(info.data);
      if (md) out.set(mints[i + j].toBase58(), { name: md.name, symbol: md.symbol });
    });
  }
  return out;
}

// ---- pool views ----

type SdkClient = InstanceType<Awaited<ReturnType<typeof loadSdk>>["DynamicBondingCurveClient"]>;
type PoolAccount = NonNullable<Awaited<ReturnType<SdkClient["state"]["getPool"]>>>;
type PoolConfig = NonNullable<Awaited<ReturnType<SdkClient["state"]["getPoolConfig"]>>>;

async function client(conn: Connection) {
  const S = await loadSdk();
  return { S, c: S.DynamicBondingCurveClient.create(conn, "confirmed") };
}

function view(
  S: Awaited<ReturnType<typeof loadSdk>>,
  poolKey: PublicKey,
  pool: PoolAccount,
  config: PoolConfig
): PoolView {
  const ps = pool.poolState; // the SDK wraps all pool fields in `poolState`
  const decimals = Number(config.tokenDecimal);
  const price = S.getPriceFromSqrtPrice(ps.sqrtPrice, decimals, SOL_DECIMALS).toNumber();
  const supply = fromRaw(config.preMigrationTokenSupply, decimals);
  const reserve = fromRaw(ps.quoteReserve, SOL_DECIMALS);
  const threshold = fromRaw(config.migrationQuoteThreshold, SOL_DECIMALS);
  return {
    pool: poolKey.toBase58(),
    mint: ps.baseMint.toBase58(),
    config: ps.config.toBase58(),
    creator: ps.creator.toBase58(),
    decimals,
    priceSol: price,
    marketCapSol: price * supply,
    quoteReserveSol: reserve,
    migrationThresholdSol: threshold,
    progress: threshold > 0 ? Math.min(1, reserve / threshold) : 0,
    isMigrated: ps.isMigrated !== 0,
    // numerator / 1e9 = fraction; * 10_000 = bps
    feeBps: Number(config.poolFees.baseFee.cliffFeeNumerator.toString()) / 100_000,
  };
}

/**
 * Find a pool. If we know its address (launched from this app) we read the account
 * directly (plain getAccountInfo). Otherwise we search by base mint, which uses
 * getProgramAccounts -- some RPC plans block that method.
 */
async function resolvePool(
  c: SdkClient,
  mintKey: PublicKey,
  poolAddress?: string
): Promise<{ publicKey: PublicKey; account: PoolAccount } | null> {
  if (poolAddress) {
    const key = new PublicKey(poolAddress);
    const account = await c.state.getPool(key);
    if (account && account.poolState.baseMint.equals(mintKey)) return { publicKey: key, account };
  }
  return c.state.getPoolByBaseMint(mintKey);
}

export async function loadPoolByMint(
  conn: Connection,
  mint: string,
  poolAddress?: string
): Promise<PoolView | null> {
  const { S, c } = await client(conn);
  const mintKey = new PublicKey(mint);
  const found = await resolvePool(c, mintKey, poolAddress);
  if (!found) return null;
  const config = await c.state.getPoolConfig(found.account.poolState.config);
  if (!config) return null;
  const v = view(S, found.publicKey, found.account, config);
  const md = (await readMetadata(conn, [mintKey])).get(mint);
  return { ...v, name: md?.name, symbol: md?.symbol };
}

/** Real launches created by this wallet, straight from the DBC program (needs getProgramAccounts on your RPC). */
export async function loadPoolsByCreator(conn: Connection, creator: PublicKey): Promise<PoolView[]> {
  const { S, c } = await client(conn);
  const pools = await c.state.getPoolsByCreator(creator);
  if (pools.length === 0) return [];

  const configKeys = [...new Set(pools.map((p) => p.account.poolState.config.toBase58()))];
  const configs = new Map<string, PoolConfig>();
  await Promise.all(
    configKeys.map(async (k) => {
      const cfg = await c.state.getPoolConfig(k);
      if (cfg) configs.set(k, cfg);
    })
  );

  const views: PoolView[] = [];
  for (const p of pools) {
    const cfg = configs.get(p.account.poolState.config.toBase58());
    if (cfg) views.push(view(S, p.publicKey, p.account, cfg));
  }
  const md = await readMetadata(conn, views.map((v) => new PublicKey(v.mint)));
  return views
    .map((v) => ({ ...v, name: md.get(v.mint)?.name, symbol: md.get(v.mint)?.symbol }))
    .sort((a, b) => b.quoteReserveSol - a.quoteReserveSol);
}

/** Wallet balance of one token (UI units). */
export async function tokenBalance(conn: Connection, owner: PublicKey, mint: string): Promise<number> {
  const res = await conn.getTokenAccountsByOwner(owner, {
    mint: new PublicKey(mint),
    programId: TOKEN_PROGRAM_ID,
  });
  let total = 0;
  for (const { account } of res.value) {
    // SPL token account layout: amount is a u64 at offset 64.
    const amount = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength).getBigUint64(64, true);
    total += Number(amount);
  }
  return total; // raw units; caller divides by 10^decimals
}

// ---- swaps ----

export type Side = "buy" | "sell";

export interface SwapPreview {
  tx: Transaction;
  side: Side;
  /** amount you receive, UI units (SOL for sells, tokens for buys) */
  expectedOut: number;
  /** worst case after slippage */
  minOut: number;
  /** trading fee, UI units of the INPUT asset */
  fee: number;
  price: number;
}

/**
 * Quote + build a bonding-curve swap.
 *  buy : spend `amount` SOL, receive the launched token
 *  sell: spend `amount` tokens, receive SOL
 */
export async function prepareSwap(
  conn: Connection,
  p: { mint: string; owner: PublicKey; side: Side; amount: string; slippageBps: number; poolAddress?: string }
): Promise<SwapPreview> {
  const { S, c } = await client(conn);
  const found = await resolvePool(c, new PublicKey(p.mint), p.poolAddress);
  if (!found) throw new Error("No bonding-curve pool found for this token");
  if (found.account.poolState.isMigrated !== 0) {
    throw new Error("This token has graduated from its bonding curve and now trades on DAMM v2.");
  }
  const config = await c.state.getPoolConfig(found.account.poolState.config);
  if (!config) throw new Error("Pool config not found");

  const decimals = Number(config.tokenDecimal);
  const swapBaseForQuote = p.side === "sell";
  const inDecimals = swapBaseForQuote ? decimals : SOL_DECIMALS;
  const outDecimals = swapBaseForQuote ? SOL_DECIMALS : decimals;
  const amountIn = toRaw(p.amount, inDecimals);
  if (amountIn.isZero()) throw new Error("Amount must be greater than 0");

  const currentPoint = await S.getCurrentPoint(conn, config.activationType);
  const quote = c.pool.swapQuote2({
    virtualPool: found.account,
    config,
    swapBaseForQuote,
    swapMode: S.SwapMode.ExactIn,
    amountIn,
    slippageBps: p.slippageBps,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
  });
  const minOut = quote.minimumAmountOut ?? quote.outputAmount;

  const tx = await c.pool.swap2({
    owner: p.owner,
    pool: found.publicKey,
    swapMode: S.SwapMode.ExactIn,
    amountIn,
    minimumAmountOut: minOut,
    swapBaseForQuote,
    referralTokenAccount: null,
  });

  return {
    tx,
    side: p.side,
    expectedOut: fromRaw(quote.outputAmount, outDecimals),
    minOut: fromRaw(minOut, outDecimals),
    fee: fromRaw(quote.tradingFee, inDecimals),
    price: S.getPriceFromSqrtPrice(found.account.poolState.sqrtPrice, decimals, SOL_DECIMALS).toNumber(),
  };
}
