const { Resend } = require("resend");

const DEFAULT_FROM = "CertChain <onboarding@resend.dev>";
const QR_CONTENT_ID = "certchain-certificate-qr";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function stripDataUrl(value) {
  return String(value || "").replace(/^data:image\/png;base64,/i, "");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function txUrl(txHash) {
  const value = String(txHash || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) return "";
  return `https://sepolia.etherscan.io/tx/${value}`;
}

function buildText(data) {
  return [
    `Xin chao ${data.recipientName},`,
    "",
    `Chung chi ${data.certId} cho khoa hoc "${data.courseName}" da duoc cap boi ${data.issuerName}.`,
    `Ngay cap: ${data.issuedDate}`,
    `Xac thuc: ${data.verifyUrl}`,
    data.pdfUrl ? `PDF: ${data.pdfUrl}` : "",
    data.txHash ? `Sepolia transaction: ${txUrl(data.txHash) || data.txHash}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtml(data) {
  const verifyUrl = safeUrl(data.verifyUrl);
  const pdfUrl = safeUrl(data.pdfUrl);
  const explorerUrl = txUrl(data.txHash);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CertChain certificate</title>
  </head>
  <body style="margin:0;background:#060B18;color:#EFF6FF;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060B18;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#0D1628;border:1px solid rgba(139,163,204,0.16);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:30px 32px;border-bottom:1px solid rgba(139,163,204,0.12);">
                <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;">
                  <span style="color:#EFF6FF;">Cert</span><span style="color:#00E5FF;">Chain</span>
                </div>
                <div style="margin-top:8px;color:#8BA3CC;font-size:14px;">Blockchain certificate notification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(0,214,143,0.13);border:1px solid rgba(0,214,143,0.26);color:#00D68F;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                  Certificate issued
                </div>
                <h1 style="margin:20px 0 8px;font-size:28px;line-height:1.2;color:#EFF6FF;">
                  Xin chao ${escapeHtml(data.recipientName)}
                </h1>
                <p style="margin:0;color:#8BA3CC;font-size:16px;line-height:1.65;">
                  Chung chi cua ban da duoc ghi nhan tren Ethereum Sepolia va co the xac thuc cong khai bang CertChain.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-collapse:separate;border-spacing:0 10px;">
                  <tr>
                    <td style="padding:16px;border-radius:14px;background:#111E35;border:1px solid rgba(139,163,204,0.12);">
                      <div style="color:#8BA3CC;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Ma chung chi</div>
                      <div style="margin-top:6px;color:#EFF6FF;font-size:18px;font-weight:700;font-family:Menlo,Consolas,monospace;">${escapeHtml(data.certId)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:14px;background:#111E35;border:1px solid rgba(139,163,204,0.12);">
                      <div style="color:#8BA3CC;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Khoa hoc</div>
                      <div style="margin-top:6px;color:#EFF6FF;font-size:18px;font-weight:700;">${escapeHtml(data.courseName)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:14px;background:#111E35;border:1px solid rgba(139,163,204,0.12);">
                      <div style="color:#8BA3CC;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Don vi cap</div>
                      <div style="margin-top:6px;color:#EFF6FF;font-size:18px;font-weight:700;">${escapeHtml(data.issuerName)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-radius:14px;background:#111E35;border:1px solid rgba(139,163,204,0.12);">
                      <div style="color:#8BA3CC;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Ngay cap</div>
                      <div style="margin-top:6px;color:#EFF6FF;font-size:18px;font-weight:700;">${escapeHtml(formatDate(data.issuedDate))}</div>
                    </td>
                  </tr>
                </table>

                ${
                  data.qrCodeBase64
                    ? `<div style="margin-top:28px;text-align:center;">
                        <div style="display:inline-block;background:#FFFFFF;padding:12px;border-radius:18px;">
                          <img src="cid:${QR_CONTENT_ID}" width="220" height="220" alt="Certificate QR code" style="display:block;border:0;" />
                        </div>
                        <div style="margin-top:10px;color:#8BA3CC;font-size:13px;">Quet QR de xac thuc chung chi</div>
                      </div>`
                    : ""
                }

                ${
                  verifyUrl
                    ? `<div style="margin-top:30px;text-align:center;">
                        <a href="${escapeHtml(verifyUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#00E5FF;color:#001018;text-decoration:none;font-size:15px;font-weight:800;padding:14px 26px;border-radius:999px;">
                          Xem chung chi
                        </a>
                      </div>`
                    : ""
                }

                <div style="margin-top:28px;padding:18px;border-radius:16px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.18);">
                  <div style="color:#00E5FF;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">Blockchain proof</div>
                  <div style="margin-top:10px;color:#8BA3CC;font-size:14px;line-height:1.7;">
                    ${data.txHash ? `Transaction: ${explorerUrl ? `<a href="${escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer" style="color:#00E5FF;">${escapeHtml(data.txHash)}</a>` : escapeHtml(data.txHash)}<br/>` : ""}
                    ${data.blockNumber ? `Block: #${escapeHtml(data.blockNumber)}<br/>` : ""}
                    ${data.issuerAddress ? `Issuer wallet: ${escapeHtml(data.issuerAddress)}<br/>` : ""}
                    Network: Ethereum Sepolia
                  </div>
                </div>

                ${
                  pdfUrl
                    ? `<p style="margin:24px 0 0;color:#8BA3CC;font-size:14px;line-height:1.6;">
                        PDF goc tren IPFS:
                        <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer" style="color:#00E5FF;">Mo tai lieu</a>
                      </p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;border-top:1px solid rgba(139,163,204,0.12);color:#4A6080;font-size:12px;line-height:1.6;">
                Email nay duoc gui tu CertChain. Hay luu lai lien ket xac thuc de chia se voi nha tuyen dung hoac don vi can doi chieu.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendCertificateEmail(data) {
  const recipientEmail = String(data?.recipientEmail || "").trim();
  if (!recipientEmail) {
    return { skipped: true, reason: "recipientEmail_missing" };
  }

  if (!process.env.RESEND_API_KEY) {
    return { skipped: true, reason: "resend_api_key_missing" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const qrBase64 = stripDataUrl(data.qrCodeBase64);
  const attachments = qrBase64
    ? [
        {
          content: qrBase64,
          filename: `QR-${data.certId || "certificate"}.png`,
          contentId: QR_CONTENT_ID,
          contentType: "image/png",
        },
      ]
    : [];

  const payload = {
    from: process.env.RESEND_FROM || DEFAULT_FROM,
    to: [recipientEmail],
    subject: `CertChain certificate issued: ${data.certId}`,
    html: buildHtml({ ...data, qrCodeBase64: qrBase64 }),
    text: buildText(data),
    attachments,
    tags: [
      { name: "type", value: "certificate_issued" },
      { name: "cert_id", value: String(data.certId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_") },
    ],
  };

  const { data: sent, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(error.message || "Resend failed to send certificate email");
  }

  return { skipped: false, data: sent };
}

module.exports = {
  sendCertificateEmail,
};
