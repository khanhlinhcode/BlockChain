import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CertResult from "@/components/CertResult";
import type { VerifyResponse } from "@/types";

jest.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "result.loadingTitle": "Verifying on blockchain...",
        "result.stepHashing": "Hashing document...",
        "result.stepQuerying": "Querying blockchain...",
        "result.stepCrossRef": "Cross-referencing hash...",
        "result.stepResult": "Generating result...",
        "result.errorTitle": "Verification Error",
        "result.errorBody": "Unable to verify this certificate right now.",
        "result.notFoundTitle": "Certificate Not Found",
        "result.notFoundBody": "Please check the certificate ID or upload the original PDF.",
        "result.requested": "Requested",
        "result.revokedTitle": "Certificate Revoked",
        "result.verifiedTitle": "Certificate Verified",
        "result.issuingOrg": "Issuing Organization",
        "result.blockchainHash": "Blockchain Hash",
        "result.revokedAt": "Revoked At",
        "result.revocationReason": "Revocation Reason",
        "result.notProvided": "Not provided",
        "result.viewDocument": "View Document",
        "result.downloadPdf": "Download PDF",
        "result.copyLink": "Copy verification link",
        "result.linkCopied": "Link Copied",
        "result.shareLinkedIn": "Share on LinkedIn",
        "result.downloadBadge": "Download badge",
        "result.verifiedAgo": `Verified ${vars?.time || "now"}`,
        "result.block": `Block #${vars?.block || 7}`,
        "common.pending": "Pending",
        "common.na": "N/A",
        "common.recipient": "Recipient",
        "common.course": "Course",
        "common.issueDate": "Issue Date",
        "common.certificateId": "Certificate ID",
        "common.copy": "Copy",
        "common.copied": "Copied",
        "common.copyError": "Copy failed",
        "common.backToHome": "Back to home",
        "common.tryAgain": "Try again",
      };
      return map[key] || key;
    },
  }),
}));

const baseCertificate = {
  _id: "1",
  certId: "CERT-2026-A3F9K2LM",
  certHash: `0x${"a".repeat(64)}`,
  ipfsCID: "bafytest",
  ipfsUrl: "https://gateway.pinata.cloud/ipfs/bafytest",
  recipientName: "Nguyen Van A",
  courseName: "Blockchain Development",
  issuingOrg: "FPT University",
  issuerAddress: "0xissuer",
  issuedAt: "2024-01-15T00:00:00.000Z",
  isRevoked: false,
  txHash: `0x${"b".repeat(64)}`,
  blockNumber: 7,
  verificationCount: 1,
  createdAt: "2024-01-15T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
};

function makeResult(overrides: Partial<VerifyResponse> = {}): VerifyResponse {
  return {
    exists: true,
    isValid: true,
    isRevoked: false,
    verifiedAt: "2024-01-16T00:00:00.000Z",
    certificate: baseCertificate,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

test("VALID state shows green checkmark and certificate details", () => {
  render(<CertResult result={makeResult()} />);
  expect(screen.getByText("Certificate Verified")).toBeInTheDocument();
  expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
  expect(screen.getByText("Blockchain Development")).toBeInTheDocument();
  expect(screen.getByText("FPT University")).toBeInTheDocument();
  expect(screen.getByText(/January 15, 2024/)).toBeInTheDocument();
});

test("VALID state shows truncated hash and copy button", () => {
  render(<CertResult result={makeResult()} />);
  expect(screen.getByText("0xaaaaaaaaaa...aaaaaaaaaa")).toBeInTheDocument();
  expect(screen.getAllByText("Copy").length).toBeGreaterThan(0);
});

test("REVOKED state shows red state and revocation details", () => {
  render(
    <CertResult
      result={makeResult({
        isValid: false,
        isRevoked: true,
        certificate: {
          ...baseCertificate,
          isRevoked: true,
          revokedAt: "2024-02-01T00:00:00.000Z",
          revokeReason: "Issued in error",
        },
      })}
    />
  );
  expect(screen.getByText("Certificate Revoked")).toBeInTheDocument();
  expect(screen.getByText("Issued in error")).toBeInTheDocument();
  expect(screen.getByText(/February 1, 2024/)).toBeInTheDocument();
});

test("NOT_FOUND state shows warning", () => {
  render(<CertResult result={{ exists: false, isValid: false, isRevoked: false, verifiedAt: new Date().toISOString() }} />);
  expect(screen.getByText("Certificate Not Found")).toBeInTheDocument();
  expect(screen.getByText("Please check the certificate ID or upload the original PDF.")).toBeInTheDocument();
});

test("LOADING state shows progress indicators", () => {
  render(<CertResult loading verificationStep={1} />);
  expect(screen.getByText("Verifying on blockchain...")).toBeInTheDocument();
  expect(screen.getByText("Hashing document...")).toBeInTheDocument();
  expect(screen.getByText("Querying blockchain...")).toBeInTheDocument();
});

test("Copy button calls navigator.clipboard.writeText", async () => {
  render(<CertResult result={makeResult()} />);
  fireEvent.click(screen.getAllByText("Copy")[0]);
  await waitFor(() => {
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CERT-2026-A3F9K2LM");
  });
});
