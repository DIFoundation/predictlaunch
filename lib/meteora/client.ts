import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { sendAndConfirm, type SignTx } from "@/lib/rpc/connection";

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
  /** Already partially signed by the two fresh keypairs below; only the wallet's signature is missing. */
  tx: Transaction;
  /** Kept for diagnostics/logging only -- signing already happened in prepareLaunch(). */
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
  // Meteora SDK methods return unsigned transactions. Sign with our two fresh
  // keypairs now, so only the wallet's own signature is missing afterwards.
  // (We deliberately do NOT rely on wallet-adapter's sendTransaction(..., { signers })
  // path: injected wallets like Phantom broadcast that call through their OWN internal
  // RPC/cluster config, silently bypassing our /api/rpc relay -- which breaks the
  // "every read and write goes through our RPC" guarantee and produced a bare
  // "Unexpected error" from the wallet when its own preflight disagreed with ours.
  // signTransaction() only asks the wallet to sign; WE broadcast via sendAndConfirm()
  // below, through the same connection everything else in the app uses.)
  tx.partialSign(config, baseMint);

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

export async function sendLaunch(
  connection: Connection,
  prepared: PreparedLaunch,
  signTransaction: SignTx
): Promise<string> {
  if (!prepared.tx.feePayer) throw new Error("Launch transaction has no fee payer.");
  if (!prepared.tx.recentBlockhash) throw new Error("Launch transaction has no recent blockhash.");

  // Guard rail: wallet-adapter's sendTransaction(transaction, connection, options?) declares
  // 2+ non-defaulted parameters; signTransaction(transaction) declares exactly 1. If the caller
  // wired up the wrong one, calling it here with a single argument leaves ITS `connection`
  // parameter undefined, and it crashes deep inside wallet-adapter with a cryptic
  // "Cannot read properties of undefined (reading 'rpcEndpoint')" -- this catches that mistake
  // at the boundary instead, with a message that says what to fix and where.
  if (typeof signTransaction !== "function" || signTransaction.length > 1) {
    throw new Error(
      "sendLaunch() was given a function that expects more than one argument -- this looks like " +
        "wallet-adapter's sendTransaction(tx, connection, options), not signTransaction(tx). " +
        "In app/launch/page.tsx, destructure `signTransaction` from useWallet() (not `sendTransaction`) " +
        "and pass that to sendLaunch(). We broadcast the transaction ourselves via our own RPC relay; " +
        "the wallet should only be asked to sign it."
    );
  }

  const serializedSize = prepared.tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
  const message = prepared.tx.compileMessage();
  const requiredSigners = message.accountKeys
    .slice(0, message.header.numRequiredSignatures)
    .map((key) => key.toBase58());

  console.info("Meteora launch: asking wallet to sign", {
    serializedSize,
    instructionCount: prepared.tx.instructions.length,
    feePayer: prepared.tx.feePayer.toBase58(),
    requiredSigners,
    configSigner: prepared.configSigner.publicKey.toBase58(),
    baseMintSigner: prepared.baseMintSigner.publicKey.toBase58(),
  });

  console.info("Meteora launch transaction diagnostics", {
    feePayer: prepared.tx.feePayer?.toBase58(),
    blockhash: prepared.tx.recentBlockhash,
    instructionCount: prepared.tx.instructions.length,

    signatures: prepared.tx.signatures.map((s, index) => ({
      index,
      publicKey: s.publicKey.toBase58(),
      signed: Boolean(s.signature),
      signatureLength: s.signature?.length ?? 0,
    })),

    requiredSigners: prepared.tx.instructions.flatMap((ix, ixIndex) =>
      ix.keys
        .filter((key) => key.isSigner)
        .map((key) => ({
          instruction: ixIndex,
          publicKey: key.pubkey.toBase58(),
          isWritable: key.isWritable,
        })),
    ),
  });

  // Convert legacy Transaction to VersionedTransaction for modern wallet compatibility
  // Phantom and other modern wallets prefer VersionedTransaction over legacy Transaction
  // const versionedTx = new VersionedTransaction(prepared.tx.compileMessage());
  // Copy over the partial signatures from the legacy transaction
  // const msg = prepared.tx.compileMessage();
  // const signatures = prepared.tx.signatures;
  // for (let i = 0; i < signatures.length; i++) {
  //   const sig = signatures[i];
  //   if (sig?.signature) {
  //     const publicKey = msg.accountKeys[i];
  //     versionedTx.addSignature(publicKey, sig.signature);
  //   }
  // }

  // Ask the wallet ONLY to sign (never to send) -- see the note in prepareLaunch()
  // for why. We then broadcast + confirm ourselves via our own RPC relay.
  const signed = await signTransaction(prepared.tx);

  // Second guard rail: signTransaction must return the (signed) transaction object back.
  // If a mismatched function slipped through the check above and returned something else
  // (e.g. wallet-adapter's sendTransaction resolves to a signature STRING, not a transaction),
  // fail clearly here rather than passing garbage into serialize()/sendAndConfirm().
  if (!signed || typeof (signed as { serialize?: unknown }).serialize !== "function") {
    throw new Error(
      "sendLaunch() expected signTransaction() to return a signed transaction object, but got " +
        `${typeof signed === "string" ? "a string (a transaction signature?)" : typeof signed}. ` +
        "Check that app/launch/page.tsx passes wallet-adapter's signTransaction, not sendTransaction."
    );
  }

  return sendAndConfirm(connection, signed, prepared.lastValidBlockHeight);
}