import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { confirmSignature } from "@/lib/rpc/connection";

/**
 * Meteora Dynamic Bonding Curve launch.
 *
 * Why this replaces the old hand-built config: the SDK ships `buildCurve*`
 * helpers that produce a complete, internally-consistent `ConfigParameters`
 * (curve points, migration thresholds, LP split, ...). Hand-rolling only
 * `poolFees` is what produced the endless "Pool fees are required ->
 * Invalid collect fee mode -> Invalid option for token update authority"
 * chain. We also use `createConfigAndPool`, which puts config + pool in ONE
 * transaction (measured ~1.06 KB, well under the 1,232-byte limit) instead of
 * the old code, which built the config tx and then threw it away.
 *
 * The SDK is imported lazily so it stays out of the initial page bundle.
 */

// Launch shape (units of the quote token, SOL). Tweak freely.
export const INITIAL_MARKET_CAP_SOL = 30;
export const MIGRATION_MARKET_CAP_SOL = 300;
export const TOTAL_SUPPLY = 1_000_000_000;

export interface LaunchParams {
  name: string;
  symbol: string;
  uri: string;
  /** Conviction-derived base trading fee, in basis points (min 25). */
  feeBps: number;
  payer: PublicKey;
}

export interface PreparedLaunch {
  /** Unsigned SDK transaction. wallet-adapter signs it with the two additional signers. */
  tx: Transaction;
  configSigner: Keypair;
  baseMintSigner: Keypair;
  baseMint: string;
  config: string;
  /** Derived DBC pool address (lets us read the pool later without getProgramAccounts). */
  pool: string;
  lastValidBlockHeight: number;
}

export async function prepareLaunch(
  connection: Connection,
  params: LaunchParams
): Promise<PreparedLaunch> {
  const S = await import("@meteora-ag/dynamic-bonding-curve-sdk");

  const curve = S.buildCurveWithMarketCap({
    token: {
      tokenType: S.TokenType.SPLToken,
      tokenBaseDecimal: S.TokenDecimal.SIX,
      tokenQuoteDecimal: S.TokenDecimal.NINE, // SOL
      tokenAuthorityOption: S.TokenAuthorityOption.Immutable,
      totalTokenSupply: TOTAL_SUPPLY,
      leftover: 0,
    },
    fee: {
      // Conviction lever: higher conviction => lower constant base fee.
      baseFeeParams: {
        baseFeeMode: S.BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: params.feeBps,
          endingFeeBps: params.feeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: S.CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: S.MigrationOption.MET_DAMM_V2,
      migrationFeeOption: S.MigrationFeeOption.FixedBps25,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: S.MigratedCollectFeeMode.QuoteToken,
        dynamicFee: S.DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 25,
      },
    },
    // LP percentages must sum to 100 (this was a hidden validation failure).
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: S.ActivationType.Slot,
    initialMarketCap: INITIAL_MARKET_CAP_SOL,
    migrationMarketCap: MIGRATION_MARKET_CAP_SOL,
  });

  const client = S.DynamicBondingCurveClient.create(connection, "confirmed");
  const config = Keypair.generate();
  const baseMint = Keypair.generate();

  const tx = await client.partner.createConfigAndPool({
    ...curve,
    config: config.publicKey,
    feeClaimer: params.payer,
    leftoverReceiver: params.payer,
    quoteMint: NATIVE_MINT,
    payer: params.payer,
    preCreatePoolParam: {
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
      poolCreator: params.payer,
      baseMint: baseMint.publicKey,
    },
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = params.payer;
  tx.recentBlockhash = blockhash;
  // Meteora SDK methods return unsigned transactions. Keep the generated
  // signer keypairs with the prepared launch so wallet-adapter can pass them
  // through its canonical `sendTransaction(..., { signers })` path.

  const pool = S.deriveDbcPoolAddress(NATIVE_MINT, baseMint.publicKey, config.publicKey);

  return {
    tx,
    configSigner: config,
    baseMintSigner: baseMint,
    baseMint: baseMint.publicKey.toBase58(),
    config: config.publicKey.toBase58(),
    pool: pool.toBase58(),
    lastValidBlockHeight,
  };
}

export interface LaunchSimulationResult {
  logs: string[];
  unitsConsumed: number | null;
}

/** Dry-run on the RPC before asking the user to sign. Throws with program logs on failure. */
export async function simulateLaunch(
  connection: Connection,
  tx: Transaction
): Promise<LaunchSimulationResult> {
  if (!tx.feePayer) throw new Error("Launch transaction has no fee payer.");
  if (!tx.recentBlockhash) throw new Error("Launch transaction has no recent blockhash.");
  if (tx.instructions.length === 0) throw new Error("Launch transaction contains no instructions.");

  const vtx = new VersionedTransaction(tx.compileMessage());
  const { value } = await connection.simulateTransaction(vtx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  const logs = value.logs ?? [];
  if (value.err) {
    const tail = logs.slice(-12).join("\n");
    throw new Error(`Simulation failed: ${JSON.stringify(value.err)}${tail ? `\n${tail}` : ""}`);
  }

  return { logs, unitsConsumed: value.unitsConsumed ?? null };
}

export type SendLaunchTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: { signers?: Keypair[] }
) => Promise<string>;

export async function sendLaunch(
  connection: Connection,
  prepared: PreparedLaunch,
  sendTransaction: SendLaunchTransaction
): Promise<string> {
  if (!prepared.tx.feePayer) throw new Error("Launch transaction has no fee payer.");
  if (!prepared.tx.recentBlockhash) throw new Error("Launch transaction has no recent blockhash.");

  const serializedSize = prepared.tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  const message = prepared.tx.compileMessage();
  const requiredSigners = message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
    .map((key) => key.toBase58());

  console.info("Meteora launch wallet submission", {
    serializedSize,
    instructionCount: prepared.tx.instructions.length,
    feePayer: prepared.tx.feePayer.toBase58(),
    requiredSigners,
    configSigner: prepared.configSigner.publicKey.toBase58(),
    baseMintSigner: prepared.baseMintSigner.publicKey.toBase58(),
  });

  const signature = await sendTransaction(prepared.tx, connection, {
    signers: [prepared.configSigner, prepared.baseMintSigner],
  });

  await confirmSignature(connection, signature, prepared.lastValidBlockHeight);
  return signature;
}
