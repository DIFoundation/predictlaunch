import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { DynamicBondingCurveClient, TokenAuthorityOption } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getConnection } from "@/lib/rpc/connection";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";

export function getMeteoraClient() {
  const connection = getConnection();
  try {
    return (DynamicBondingCurveClient as any).create(connection, "confirmed");
  } catch {
    return new DynamicBondingCurveClient(connection, "confirmed");
  }
}

export async function createTokenWithDBC(params: {
  name: string;
  symbol: string;
  uri?: string;
  payer: PublicKey;
  signTransaction: (tx: any) => Promise<any>;
}) {
  const connection = getConnection();
  const client = getMeteoraClient();
  const baseMint = Keypair.generate();
  const configKeypair = Keypair.generate();

  try {
    const poolFees = {
      baseFee: {
        cliffFeeNumerator: new BN(25_000_000),
        firstFactor: 0,
        secondFactor: new BN(0),
        thirdFactor: new BN(0),
        baseFeeMode: 0,
      },
      dynamicFee: null,
    };

    // Create config with required fields
    if (typeof (client as any).partner?.createConfig === "function") {
      await (client as any).partner.createConfig({
        config: configKeypair.publicKey,
        feeClaimer: params.payer,
        leftoverReceiver: params.payer,
        payer: params.payer,
        quoteMint: NATIVE_MINT,
        poolFees,
        collectFeeMode: 0,
        TokenAuthorityOption: 0
      });
    }

    // Create the pool
    const createPoolTx = await (client as any).creator.createPool({
      baseMint: baseMint.publicKey,
      config: configKeypair.publicKey,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri || "https://predictlaunch.xyz",
      payer: params.payer,
      poolCreator: params.payer,
    });

    return await signAndSend(
      createPoolTx,
      params,
      [baseMint, configKeypair],
      connection
    );
  } catch (error: any) {
    console.error("Meteora full error:", error);

    return {
      success: false,
      error: error?.message || "Still refining the default Meteora config",
      mint: baseMint.publicKey.toBase58(),
    };
  }
}

async function signAndSend(
  tx: any,
  params: { payer: PublicKey; signTransaction: (tx: any) => Promise<any> },
  extraSigners: Keypair[],
  connection: Connection
) {
  if (!(tx instanceof Transaction)) {
    throw new Error("Unexpected transaction type from Meteora SDK");
  }

  tx.feePayer = params.payer;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  extraSigners.forEach((kp) => tx.partialSign(kp));

  const signedTx = await params.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return {
    success: true,
    signature,
    mint: extraSigners[0].publicKey.toBase58(),
    message: "Token + DBC pool created successfully",
  };
}