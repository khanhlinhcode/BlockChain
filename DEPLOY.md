# CertChain Deployment Guide (100% Free / Free Trial)

Mục tiêu production demo:

- Frontend: `https://certchain-app.vercel.app`
- Backend: `https://certchain-api.up.railway.app`
- MongoDB: MongoDB Atlas M0 Free
- Blockchain: Ethereum Sepolia `11155111`
- Contract: `0xAE5E724aeFf37F602B45CC63e85a7C07C46d1201`

Lưu ý thực tế 2026: Vercel Hobby và MongoDB Atlas M0 có free tier rõ ràng. Railway có free trial/credit, nhưng mức network/deploy phụ thuộc xác minh tài khoản GitHub; nếu tài khoản không được verify có thể bị hạn chế network. Không commit bất kỳ `.env` hoặc private key nào.

## STEP A - MongoDB Atlas M0 Free

1. Vào `https://mongodb.com/atlas` và đăng ký tài khoản miễn phí.
2. Create Organization -> Create Project -> Build a Cluster.
3. Chọn `M0 FREE`, cloud provider gần Singapore nếu có, cluster name: `certchain-prod`.
4. Database user:
   - Username: `certchain`
   - Password: auto-generate và lưu lại.
5. Network Access:
   - Add IP Address: `0.0.0.0/0`
   - Lý do: Railway/Vercel IP thay đổi, demo free cần mở rộng.
6. Connect -> Drivers -> Node.js.
7. Copy connection string:

```txt
mongodb+srv://certchain:<PASSWORD>@certchain-prod.xxxxx.mongodb.net/certchain?retryWrites=true&w=majority
```

8. Thay `<PASSWORD>` bằng password thật.
9. Lưu URI này để cấu hình Railway.

## STEP B - Railway Backend

1. Vào `https://railway.app` và đăng nhập bằng GitHub.
2. New Project -> Deploy from GitHub repo.
3. Chọn repo CertChain.
4. Nếu Railway hỏi root folder, chọn `backend`.
5. Railway dùng Nixpacks theo `backend/railway.json`.

Thêm Environment Variables trong Railway:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://certchain:PASSWORD@certchain-prod.xxxxx.mongodb.net/certchain?retryWrites=true&w=majority
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=replace_with_long_random_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM=CertChain <onboarding@resend.dev>
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/T0MLzImzKuTL5C7pVzAds
CONTRACT_ADDRESS=0xAE5E724aeFf37F602B45CC63e85a7C07C46d1201
ADMIN_PRIVATE_KEY=your_backend_admin_wallet_private_key
FRONTEND_URL=https://certchain-app.vercel.app
PUBLIC_FRONTEND_URL=https://certchain-app.vercel.app
NEXT_PUBLIC_FRONTEND_URL=https://certchain-app.vercel.app
CORS_ALLOWED_ORIGINS=https://certchain-app.vercel.app
AUDIT_ENABLE_CHAIN_EVENTS=false
AUDIT_SCAN_FROM_DEPLOY=false
AUDIT_LOG_BLOCK_WINDOW=10
AUDIT_LOOKBACK_BLOCKS=1000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_this_password
```

Ghi chú:

- `ADMIN_PRIVATE_KEY` chỉ dùng cho backend-signed issue và revoke bằng backend. MetaMask issue không dùng key này.
- Ví của `ADMIN_PRIVATE_KEY` phải là admin của contract nếu muốn dùng backend-signed flow.
- Không nhập private key vào Vercel/frontend.

Sau khi deploy:

1. Settings -> Generate Domain.
2. Nếu domain Railway khác `https://certchain-api.up.railway.app`, dùng domain Railway thực tế của bạn.
3. Test health:

```bash
curl https://certchain-api.up.railway.app/health
```

Kết quả cần có:

```json
{
  "status": "ok",
  "network": "Ethereum Sepolia (11155111)"
}
```

Seed admin:

```bash
curl -X POST https://certchain-api.up.railway.app/api/auth/seed
```

## STEP C - Vercel Frontend

1. Vào `https://vercel.com` và đăng nhập GitHub.
2. New Project -> Import repo CertChain.
3. Root Directory: `frontend`.
4. Framework: Next.js.
5. Build Command: `npm run build`.
6. Output Directory: `.next`.

Thêm Environment Variables trong Vercel:

```env
NEXT_PUBLIC_API_URL=https://certchain-api.up.railway.app/api
NEXT_PUBLIC_FRONTEND_URL=https://certchain-app.vercel.app
NEXT_PUBLIC_APP_URL=https://certchain-app.vercel.app
NEXT_PUBLIC_CONTRACT_ADDRESS=0xAE5E724aeFf37F602B45CC63e85a7C07C46d1201
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/T0MLzImzKuTL5C7pVzAds
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/T0MLzImzKuTL5C7pVzAds
NEXT_PUBLIC_ALCHEMY_KEY=T0MLzImzKuTL5C7pVzAds
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
NEXT_PUBLIC_ISSUING_ORG=CertChain
BACKEND_URL=https://certchain-api.up.railway.app
```

Deploy xong, nếu Vercel tạo domain khác với `certchain-app.vercel.app`, cập nhật lại các biến sau:

Railway:

```env
FRONTEND_URL=https://your-real-vercel-domain.vercel.app
PUBLIC_FRONTEND_URL=https://your-real-vercel-domain.vercel.app
NEXT_PUBLIC_FRONTEND_URL=https://your-real-vercel-domain.vercel.app
CORS_ALLOWED_ORIGINS=https://your-real-vercel-domain.vercel.app
```

Vercel:

```env
NEXT_PUBLIC_FRONTEND_URL=https://your-real-vercel-domain.vercel.app
NEXT_PUBLIC_APP_URL=https://your-real-vercel-domain.vercel.app
```

Sau đó redeploy cả backend và frontend.

## STEP C.1 - Resend Email Notification

1. Vào `https://resend.com` và tạo tài khoản.
2. Dashboard -> API Keys -> Create API Key.
3. Copy key dạng `re_xxx`.
4. Thêm vào Railway backend environment:

```env
RESEND_API_KEY=re_xxx
RESEND_FROM=CertChain <onboarding@resend.dev>
```

5. Với free tier và sender `onboarding@resend.dev`, Resend có thể giới hạn người nhận theo tài khoản/domain. Khi dùng production thật, hãy verify domain riêng rồi đổi `RESEND_FROM`.
6. Email được gửi sau khi certificate issue/sync thành công. Nếu Resend lỗi, API cấp chứng chỉ vẫn trả thành công và backend chỉ log lỗi.

## STEP D - QR URL Production

Backend tạo QR từ `NEXT_PUBLIC_FRONTEND_URL`, `PUBLIC_FRONTEND_URL` hoặc `FRONTEND_URL`.

Production phải là:

```txt
https://certchain-app.vercel.app/verify/CERT-XXX
```

Không được là:

```txt
http://localhost:3000/verify/CERT-XXX
```

Nếu QR vẫn ra localhost, kiểm tra lại Railway env:

```env
NEXT_PUBLIC_FRONTEND_URL=https://certchain-app.vercel.app
FRONTEND_URL=https://certchain-app.vercel.app
PUBLIC_FRONTEND_URL=https://certchain-app.vercel.app
```

## STEP E - Verify Everything Works

Checklist sau deploy:

- Open `https://certchain-app.vercel.app` -> page loads.
- `curl https://certchain-api.up.railway.app/health` -> status ok.
- `/admin/login` -> login works.
- Seed admin nếu chưa có.
- Issue certificate via MetaMask -> Sepolia tx `From` là ví MetaMask.
- Issue certificate via backend -> Sepolia tx `From` là backend admin wallet.
- Certificates list -> certificate appears after sync.
- Audit log -> shows issued event.
- Scan QR with phone -> opens production Vercel URL.
- `/verify/CERT-XXX` -> shows valid/revoked/not found state.
- Upload original PDF -> verifies by hash.

## FREE TIER LIMITS

| Service | Free / Trial Limit | Enough for demo? |
| --- | --- | --- |
| Vercel Hobby | Free personal projects with usage caps | Yes |
| Railway | Free trial/credit; verification may affect network access | Usually yes for demo |
| MongoDB Atlas M0 | 512MB free shared cluster | Yes |
| Alchemy Free | Free monthly compute units and rate limits | Yes |
| Pinata Free | Free plan with storage/request limits | Yes for small demo PDFs |

## Custom Subdomain Options

Recommended for demo:

```txt
https://certchain-app.vercel.app
```

Optional custom domain if you own one:

```txt
https://certchain.tech
```

Avoid unreliable free TLDs for serious demos because some browsers and networks block them.

## Local Dev After Deployment

Local `.env` files can stay local-only:

- `backend/.env`
- `frontend/.env.local`
- `smart-contract/.env`

Do not commit them. Production values live in Railway/Vercel dashboards.

## Useful Commands

Run checks locally:

```bash
cd frontend && npm run build
cd ../backend && npm test
cd ../smart-contract && npx hardhat test
```

Check backend production health:

```bash
curl https://certchain-api.up.railway.app/health
curl https://certchain-api.up.railway.app/api/health
```

Seed admin production:

```bash
curl -X POST https://certchain-api.up.railway.app/api/auth/seed
```
