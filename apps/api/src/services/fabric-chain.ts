import { readFileSync, readdirSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';
import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import {
  connect,
  signers,
  type Contract,
  type Gateway,
  type GatewayError,
} from '@hyperledger/fabric-gateway';
import type { Agenda, Ballot, TallyProof, TrusteeDecryptionShare } from '@ovote/shared';
import type { Config } from '../config.js';
import { CredentialAlreadyUsedError, type ChainGateway } from './chain.js';

// FabricChain routes every ChainGateway call through @hyperledger/fabric-gateway
// to the on-chain `ovote` contract. Writes use submitTransaction (full
// endorsement + ordering); reads use evaluateTransaction (peer-local query).
//
// The gateway SDK talks gRPC to a single peer; the peer handles discovery and
// endorsement policy (MAJORITY Endorsement from configtx). That keeps this
// wrapper thin — we only stringify/parse JSON and translate "not found" into
// the shape the rest of the API expects.
export class FabricChain implements ChainGateway {
  private constructor(
    private readonly client: grpc.Client,
    private readonly gateway: Gateway,
    private readonly contract: Contract,
  ) {}

  static async connect(config: Config): Promise<FabricChain> {
    const tlsPath = requireField(config.OVOTE_FABRIC_TLS_ROOT_CERT, 'OVOTE_FABRIC_TLS_ROOT_CERT');
    const signcertPath = requireField(config.OVOTE_FABRIC_SIGNCERT, 'OVOTE_FABRIC_SIGNCERT');
    const keystoreDir = requireField(config.OVOTE_FABRIC_KEYSTORE_DIR, 'OVOTE_FABRIC_KEYSTORE_DIR');

    const tlsRootCert = readFileSync(tlsPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    const client = new grpc.Client(config.OVOTE_FABRIC_PEER_ENDPOINT, tlsCredentials, {
      'grpc.ssl_target_name_override': config.OVOTE_FABRIC_PEER_HOSTNAME_OVERRIDE,
    });

    const identity = {
      mspId: config.OVOTE_FABRIC_MSP_ID,
      credentials: readFileSync(signcertPath),
    };

    // cryptogen produces exactly one file under keystore/; the name is an
    // opaque SHA-based hash, so we pick whatever is there rather than hard-
    // coding priv_sk.
    const keyFiles = readdirSync(keystoreDir);
    if (keyFiles.length === 0) {
      throw new Error(`OVOTE_FABRIC_KEYSTORE_DIR ${keystoreDir} is empty`);
    }
    const keyPem = readFileSync(join(keystoreDir, keyFiles[0]!));
    const signer = signers.newPrivateKeySigner(createPrivateKey(keyPem));

    const gateway = connect({ client, identity, signer });
    const network = gateway.getNetwork(config.OVOTE_FABRIC_CHANNEL);
    const contract = network.getContract(config.OVOTE_FABRIC_CHAINCODE);

    return new FabricChain(client, gateway, contract);
  }

  async close(): Promise<void> {
    this.gateway.close();
    this.client.close();
  }

  // ---- writes --------------------------------------------------------------

  async createAgenda(agenda: Agenda): Promise<void> {
    await this.submit('CreateAgenda', JSON.stringify(agenda));
  }

  async openAgenda(agendaId: string): Promise<void> {
    await this.submit('OpenAgenda', agendaId);
  }

  async closeAgenda(agendaId: string): Promise<void> {
    await this.submit('CloseAgenda', agendaId);
  }

  async castBallot(ballot: Ballot): Promise<void> {
    try {
      await this.submit('CastBallot', JSON.stringify(ballot));
    } catch (err) {
      // Normalize to the same typed error MemoryChain throws so the ballot
      // route can translate it into a 409 with `instanceof` instead of
      // substring-matching the chaincode message.
      const msg = (err as Error).message;
      if (/credential already used/i.test(msg)) {
        throw new CredentialAlreadyUsedError();
      }
      throw err;
    }
  }

  async submitDecryptionShare(share: TrusteeDecryptionShare): Promise<void> {
    await this.submit('SubmitDecryptionShare', JSON.stringify(share));
  }

  async publishResult(result: TallyProof): Promise<void> {
    await this.submit('PublishResult', JSON.stringify(result));
  }

  // ---- reads ---------------------------------------------------------------

  async getAgenda(agendaId: string): Promise<Agenda> {
    const raw = await this.evaluate('GetAgenda', agendaId);
    return JSON.parse(raw) as Agenda;
  }

  async listAgendas(): Promise<Agenda[]> {
    const raw = await this.evaluate('ListAgendas');
    return (JSON.parse(raw) as Agenda[] | null) ?? [];
  }

  async listBallots(agendaId: string): Promise<Ballot[]> {
    const raw = await this.evaluate('ListBallots', agendaId);
    return (JSON.parse(raw) as Ballot[] | null) ?? [];
  }

  async listDecryptionShares(agendaId: string): Promise<TrusteeDecryptionShare[]> {
    const raw = await this.evaluate('ListDecryptionShares', agendaId);
    return (JSON.parse(raw) as TrusteeDecryptionShare[] | null) ?? [];
  }

  async getResult(agendaId: string): Promise<TallyProof | null> {
    try {
      const raw = await this.evaluate('GetResult', agendaId);
      return JSON.parse(raw) as TallyProof;
    } catch (err) {
      const msg = (err as Error).message;
      if (/no result for agenda/i.test(msg)) return null;
      throw err;
    }
  }

  // ---- helpers -------------------------------------------------------------

  private async submit(name: string, ...args: string[]): Promise<Uint8Array> {
    try {
      return await this.contract.submitTransaction(name, ...args);
    } catch (err) {
      throw toError(err, name);
    }
  }

  private async evaluate(name: string, ...args: string[]): Promise<string> {
    try {
      const bytes = await this.contract.evaluateTransaction(name, ...args);
      return new TextDecoder().decode(bytes);
    } catch (err) {
      throw toError(err, name);
    }
  }
}

function requireField<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} must be set when OVOTE_CHAIN_DRIVER=fabric`);
  }
  return value;
}

function toError(err: unknown, method: string): Error {
  // Fabric gateway errors expose .details[].message; surface the useful bit.
  const ge = err as Partial<GatewayError> & { details?: Array<{ message?: string }>; message?: string };
  const detail = ge.details?.[0]?.message ?? ge.message ?? String(err);
  return new Error(`${method}: ${detail}`);
}
