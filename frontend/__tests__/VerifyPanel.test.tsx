import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyPanel from "@/components/verification/VerifyPanel";
import { useVerificationFlow } from "@/hooks/useVerificationFlow";

const push = jest.fn();
const setError = jest.fn();
const reset = jest.fn();
const verifyById = jest.fn();
const verifyByFile = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/components/QRScanner", () => function QRScannerMock() {
  return <div>QR scanner ready</div>;
});

jest.mock("@/hooks/useVerificationFlow", () => ({
  useVerificationFlow: jest.fn(),
}));

jest.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) =>
      ({
        "verify.console": "Verification Console",
        "verify.title": "Verify a certificate",
        "verify.live": "Live",
        "verify.tabId": "Certificate ID",
        "verify.tabFile": "Upload PDF",
        "verify.scanInstead": "Scan QR instead",
        "verify.openCamera": "Open camera",
        "verify.idRequired": "Certificate ID is required.",
        "verify.verifying": "Verifying on blockchain...",
        "verify.submit": "Verify Certificate",
        "verify.dropPdf": "Drop certificate PDF",
        "verify.clickBrowse": "or click to browse",
        "verify.pdfLimit": "PDF only · Max 10MB",
        "verify.start": "Start Verification",
        "verify.pdfOnlyError": "Only PDF files up to 10MB are supported.",
        "result.verifiedTitle": "Certificate Verified",
        "result.notFoundTitle": "Certificate Not Found",
        "result.notFoundBody": "Please check the certificate ID or upload the original PDF.",
        "result.requested": "Requested",
        "common.na": "N/A",
        "common.recipient": "Recipient",
        "common.course": "Course",
        "common.issueDate": "Issue Date",
        "common.certificateId": "Certificate ID",
        "common.copy": "Copy",
        "common.copied": "Copied",
        "result.issuingOrg": "Issuing Organization",
        "result.blockchainHash": "Blockchain Hash",
        "result.viewDocument": "View Document",
        "result.downloadPdf": "Download PDF",
        "result.copyLink": "Copy verification link",
        "result.shareLinkedIn": "Share on LinkedIn",
        "result.downloadBadge": "Download badge",
        "result.verifiedAgo": "Verified now",
        "result.block": "Block #7",
      }[key] || key),
  }),
}));

function mockFlow(overrides = {}) {
  (useVerificationFlow as jest.Mock).mockReturnValue({
    loading: false,
    verificationStep: -1,
    result: null,
    error: null,
    lastQueryId: "",
    hasResult: false,
    setError,
    reset,
    verifyById,
    verifyByFile,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlow();
});

test("renders tab switcher", () => {
  render(<VerifyPanel />);
  expect(screen.getByRole("button", { name: "Certificate ID" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Upload PDF" })).toBeInTheDocument();
});

test("submit with empty ID shows validation error", async () => {
  const user = userEvent.setup();
  render(<VerifyPanel />);

  await user.click(screen.getByRole("button", { name: "Verify Certificate" }));
  expect(setError).toHaveBeenCalledWith("Certificate ID is required.");
  expect(verifyById).not.toHaveBeenCalled();
});

test("submit with valid ID calls verifyById", async () => {
  const user = userEvent.setup();
  render(<VerifyPanel />);

  await user.type(screen.getByPlaceholderText("CERT-2026-0DXT0YUK"), "CERT-2026-A3F9K2LM");
  await user.click(screen.getByRole("button", { name: "Verify Certificate" }));

  expect(verifyById).toHaveBeenCalledWith("CERT-2026-A3F9K2LM");
});

test("shows loading spinner during API call", () => {
  mockFlow({ loading: true, hasResult: true, verificationStep: 1 });
  render(<VerifyPanel />);
  expect(screen.getByText("Verifying on blockchain...")).toBeInTheDocument();
});

test("displays CertResult on success", () => {
  mockFlow({
    hasResult: true,
    result: {
      exists: true,
      isValid: true,
      isRevoked: false,
      verifiedAt: "2026-01-15T00:00:00.000Z",
      certificate: {
        _id: "1",
        certId: "CERT-2026-A3F9K2LM",
        certHash: `0x${"a".repeat(64)}`,
        ipfsCID: "bafytest",
        ipfsUrl: "https://gateway.pinata.cloud/ipfs/bafytest",
        recipientName: "Nguyen Van A",
        courseName: "Blockchain Development",
        issuingOrg: "FPT University",
        issuerAddress: "0xissuer",
        issuedAt: "2026-01-15T00:00:00.000Z",
        isRevoked: false,
        txHash: `0x${"b".repeat(64)}`,
        blockNumber: 7,
        verificationCount: 1,
        createdAt: "2026-01-15T00:00:00.000Z",
        updatedAt: "2026-01-15T00:00:00.000Z",
      },
    },
  });

  render(<VerifyPanel />);
  expect(screen.getByText("Certificate Verified")).toBeInTheDocument();
  expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
});

test("displays error message on API failure", () => {
  mockFlow({ hasResult: true, error: "Network error. Please try again." });
  render(<VerifyPanel />);
  expect(screen.getByText("Network error. Please try again.")).toBeInTheDocument();
});

test("file dropzone accepts PDF and rejects non-PDF", async () => {
  render(<VerifyPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toHaveAttribute("accept", "application/pdf,.pdf");

  const file = new File(["not pdf"], "test.txt", { type: "text/plain" });
  fireEvent.drop(screen.getByText("Drop certificate PDF").closest("div") as HTMLElement, {
    dataTransfer: { files: [file], types: ["Files"] },
  });

  await waitFor(() => {
    expect(setError).toHaveBeenCalledWith("Only PDF files up to 10MB are supported.");
  });
});
