"use client";

import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/constants";
import { getFriendlyError } from "@/lib/errorMessages";
import { useMetaMask } from "./useMetaMask";

type ContractCert = {
  certHash: string;
  ipfsCID: string;
  issuer: string;
  issuedAt: number;
  isRevoked: boolean;
  recipientName: string;
  certId: string;
  courseName: string;
  issuingOrg: string;
  revokedAt: number;
  revokedBy: string;
};

type VerifyResult = {
  exists: boolean;
  isValid: boolean;
  isRevoked: boolean;
};

export function useContract() {
  const { provider, signer } = useMetaMask();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerifyResult | ContractCert | null>(null);

  const contract = useMemo(() => {
    if (!CONTRACT_ADDRESS || !provider) return null;
    try {
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer ?? provider);
    } catch {
      return null;
    }
  }, [provider, signer]);

  const verifyCertificate = useCallback(
    async (hash: string) => {
      if (!contract) throw new Error("Contract is not initialized.");
      setLoading(true);
      setError(null);
      try {
        const [exists, isValid, isRevoked] = await contract.verifyCertificate.staticCall(
          hash
        );
        const result = { exists, isValid, isRevoked } as VerifyResult;
        setData(result);
        return result;
      } catch (err: unknown) {
        const message = getFriendlyError(err, "verifyCertificate failed");
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [contract]
  );

  const getCertificate = useCallback(
    async (hash: string) => {
      if (!contract) throw new Error("Contract is not initialized.");
      setLoading(true);
      setError(null);
      try {
        const raw = await contract.getCertificate(hash);
        const cert: ContractCert = {
          certHash: String(raw.certHash),
          ipfsCID: String(raw.ipfsCID),
          issuer: String(raw.issuer),
          issuedAt: Number(raw.issuedAt),
          isRevoked: Boolean(raw.isRevoked),
          recipientName: String(raw.recipientName),
          certId: String(raw.certId),
          courseName: String(raw.courseName),
          issuingOrg: String(raw.issuingOrg),
          revokedAt: Number(raw.revokedAt),
          revokedBy: String(raw.revokedBy),
        };
        setData(cert);
        return cert;
      } catch (err: unknown) {
        const message = getFriendlyError(err, "getCertificate failed");
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [contract]
  );

  return {
    contract,
    loading,
    error,
    data,
    verifyCertificate,
    getCertificate,
  };
}
