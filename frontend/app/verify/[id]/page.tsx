import type { Metadata } from "next";
import VerifyByIdContent from "@/components/verification/VerifyByIdContent";
import { API_BASE_URL } from "@/lib/constants";
import type { VerifyResponse } from "@/types";

interface VerifyPageProps {
  params: {
    id: string;
  };
}

async function fetchVerification(certId: string): Promise<VerifyResponse | null> {
  const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/verify/by-id`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ certId }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const payload = (await res.json()) as
      | VerifyResponse
      | { success?: boolean; data?: VerifyResponse };

    if ("success" in payload && payload.success === false) return null;
    if ("data" in payload && payload.data) return payload.data;
    return payload as VerifyResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const certId = decodeURIComponent(params.id);
  const verification = await fetchVerification(certId);
  const certificate = verification?.certificate;

  const title = certificate?.recipientName
    ? `Certificate: ${certificate.recipientName} | CertChain`
    : `Verify ${certId} | CertChain`;
  const description =
    certificate?.courseName && certificate?.issuingOrg
      ? `Verified certificate for ${certificate.courseName} from ${certificate.issuingOrg}`
      : `Validate certificate ${certId} on CertChain blockchain verification.`;
  const canonicalPath = `/verify/${encodeURIComponent(certId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "CertChain",
      url: canonicalPath,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function VerifyByIdPage({ params }: VerifyPageProps) {
  const certId = decodeURIComponent(params.id);
  const result = await fetchVerification(certId);

  return <VerifyByIdContent certId={certId} result={result} />;
}
