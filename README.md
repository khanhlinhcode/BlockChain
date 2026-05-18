# CertChain

CertChain là hệ thống cấp và xác thực chứng chỉ bằng blockchain.

Project gồm 3 phần chính:

- `smart-contract`: Hardhat + Solidity, lưu trạng thái chứng chỉ on-chain.
- `backend`: Express + MongoDB + ethers.js, xử lý API, IPFS, QR, JWT và giao dịch blockchain.
- `frontend`: Next.js 14, giao diện xác thực công khai và dashboard quản trị.

## 1. Cách Chạy Khuyến Nghị: Docker Dev

Cách này là đơn giản nhất. Docker sẽ tự chạy đủ 4 service:

- MongoDB
- Hardhat local blockchain
- Deploy smart contract local
- Backend API
- Frontend Next.js

### 1.1. Yêu cầu

Cài trước:

- Docker Desktop
- Node.js 20+ nếu muốn chạy lệnh test/lint ngoài Docker
- MetaMask nếu muốn test đăng nhập ví

Kiểm tra Docker:

```bash
docker --version
docker compose version
```

Nếu Docker báo không kết nối được socket, hãy mở Docker Desktop trước.

### 1.2. Chạy toàn bộ project

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain
./scripts/dev-docker.sh
```

Script này tự lấy IP LAN của máy Mac và in ra dạng:

```txt
CertChain Docker dev stack
- Frontend: http://192.168.x.x:3000
- Backend:  http://192.168.x.x:5001/api
- Hardhat:  http://localhost:8545
```

Mở trên máy Mac:

```txt
http://localhost:3000
```

Mở trên điện thoại cùng Wi-Fi:

```txt
http://192.168.x.x:3000
```

### 1.3. Seed tài khoản admin

Sau khi backend chạy xong, mở terminal khác:

```bash
curl -X POST http://localhost:5001/api/auth/seed
```

Tài khoản mặc định:

```txt
Username: admin
Password: Admin@123456
```

### 1.4. Kiểm tra service

```bash
docker compose -f docker-compose.dev.yml ps
```

Kết quả đúng: `mongodb`, `hardhat`, `backend`, `frontend` đều `Up`.

Kiểm tra backend:

```bash
curl -s http://localhost:5001/health
```

Kết quả đúng có dạng:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "chain": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
}
```

### 1.5. Dừng Docker

Dừng service nhưng giữ database:

```bash
docker compose -f docker-compose.dev.yml down
```

Dừng và xóa sạch database dev:

```bash
docker compose -f docker-compose.dev.yml down -v
```

### 1.6. Chạy lại Docker sau khi tắt máy

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain
./scripts/dev-docker.sh
```

Không cần chạy MongoDB local riêng. Docker đã chạy MongoDB trong container.

## 2. Biến Môi Trường Khi Chạy Docker

Docker dev dùng `docker-compose.dev.yml` và tự override phần quan trọng sau:

- `MONGODB_URI=mongodb://mongodb:27017/certchain`
- `ALCHEMY_URL=http://hardhat:8545`
- `CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3`
- `ADMIN_PRIVATE_KEY=<Hardhat account #0>`
- `NEXT_PUBLIC_CHAIN_ID=31337`
- `SERVER_API_URL=http://backend:5001/api`

Vì vậy, khi chạy bằng Docker dev:

- Không cần tự chạy `mongod`.
- Không cần tự chạy `npx hardhat node`.
- Không cần deploy contract thủ công.
- Không cần sửa `MONGODB_URI` trong `backend/.env` để trỏ tới container.

### 2.1. `frontend/.env.local` khi chạy Docker

File này vẫn nên có để browser dùng đúng API LAN:

```env
NEXT_PUBLIC_API_URL=http://YOUR_MAC_IP:5001/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
NEXT_PUBLIC_ISSUING_ORG=CertChain
```

Nếu chỉ mở bằng máy Mac, có thể dùng:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```

Nếu mở bằng điện thoại, bắt buộc dùng IP LAN, ví dụ:

```env
NEXT_PUBLIC_API_URL=http://192.168.0.193:5001/api
```

Lấy IP LAN:

```bash
ipconfig getifaddr en0
```

### 2.2. `backend/.env` khi chạy Docker

Docker dev vẫn đọc `backend/.env` cho các biến không override, ví dụ JWT, Pinata, admin seed.

Ví dụ tối thiểu:

```env
PORT=5001
NODE_ENV=development

JWT_SECRET=change_me_local
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=change_me_refresh_local
JWT_REFRESH_EXPIRES_IN=7d

PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs

FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://YOUR_MAC_IP:3000
BASE_URL=http://localhost:5001

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456
```

Nếu chưa có Pinata key, phần upload IPFS thật có thể lỗi. Các phần login, dashboard, verify record đã có vẫn chạy được.

## 3. Cách Chạy Thủ Công Không Dùng Docker

Chỉ dùng cách này khi muốn debug từng service riêng.

Cần mở nhiều terminal.

### 3.1. Terminal 1: MongoDB

Nếu cài bằng Homebrew:

```bash
brew services start mongodb-community
```

Hoặc bản cụ thể:

```bash
brew services start mongodb-community@7.0
```

Kiểm tra:

```bash
mongosh --quiet --eval "db.adminCommand({ ping: 1 })" mongodb://127.0.0.1:27017/certchain
```

Đúng thì trả:

```js
{ ok: 1 }
```

### 3.2. Terminal 2: Hardhat local blockchain

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain/smart-contract
npx hardhat node
```

Giữ terminal này luôn mở.

### 3.3. Terminal 3: Deploy smart contract

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain/smart-contract
npx hardhat run scripts/deploy.js --network localhost
```

Copy contract address sau deploy, ví dụ:

```txt
0x5FbDB2315678afecb367f032d93F642f64180aa3
```

Cập nhật vào:

`backend/.env`:

```env
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ALCHEMY_URL=http://127.0.0.1:8545
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CHAIN_ID=31337
```

Private key trên là Hardhat account #0, chỉ dùng local dev.

### 3.4. Terminal 4: Backend

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain/backend
npm ci
npm run dev
```

Backend chạy ở:

```txt
http://localhost:5001
```

Seed admin:

```bash
curl -X POST http://localhost:5001/api/auth/seed
```

### 3.5. Terminal 5: Frontend

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain/frontend
npm ci
npm run dev
```

Frontend chạy ở:

```txt
http://localhost:3000
```

## 4. File Env Mẫu Cho Chạy Thủ Công

### 4.1. Backend `backend/.env`

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/certchain

JWT_SECRET=change_me_local
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=change_me_refresh_local
JWT_REFRESH_EXPIRES_IN=7d

PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs

ALCHEMY_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_DEPLOY_BLOCK=0
AUDIT_LOOKBACK_BLOCKS=300
AUDIT_LOG_BLOCK_WINDOW=10

FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
BASE_URL=http://localhost:5001

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456
```

Nếu test QR bằng điện thoại, đổi `FRONTEND_URL` và `CORS_ALLOWED_ORIGINS` sang IP LAN:

```env
FRONTEND_URL=http://YOUR_MAC_IP:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://YOUR_MAC_IP:3000
```

### 4.2. Frontend `frontend/.env.local`

Máy Mac local:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
NEXT_PUBLIC_ISSUING_ORG=CertChain
```

Điện thoại cùng Wi-Fi:

```env
NEXT_PUBLIC_API_URL=http://YOUR_MAC_IP:5001/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
NEXT_PUBLIC_ISSUING_ORG=CertChain
```

Sau khi sửa env, restart service liên quan.

## 5. Luồng Hoạt Động

### 5.1. Cấp chứng chỉ

1. Admin đăng nhập.
2. Admin nhập người nhận, khóa học, tổ chức.
3. Admin upload PDF.
4. Backend tính SHA-256 hash của PDF.
5. Backend upload PDF lên IPFS.
6. Backend gọi smart contract `issueCertificate`.
7. Backend lưu metadata vào MongoDB.
8. Backend tạo QR trỏ tới `/verify/{certId}`.

### 5.2. Xác thực chứng chỉ

Người dùng xác thực bằng một trong ba cách:

- Nhập mã chứng chỉ.
- Upload PDF gốc.
- Quét QR.

Backend sẽ:

1. Tìm chứng chỉ trong MongoDB.
2. Đối chiếu trạng thái on-chain qua smart contract.
3. Trả kết quả hợp lệ, đã thu hồi hoặc không tìm thấy.

## 6. API Chính

Base URL:

```txt
http://localhost:5001/api
```

Auth:

```txt
POST /auth/seed
POST /auth/login
POST /auth/login-metamask
POST /auth/link-wallet
POST /auth/logout
GET  /auth/me
```

Certificates admin, yêu cầu JWT:

```txt
POST /certificates/issue
GET  /certificates
GET  /certificates/stats
GET  /certificates/audit
GET  /certificates/:certId
GET  /certificates/:certId/qr
PUT  /certificates/:certHash/revoke
```

Verify public:

```txt
POST /verify/by-id
POST /verify/by-file
POST /verify/by-hash
GET  /verify/:certId/history
```

Health:

```txt
GET /health
GET /api/health
```

## 7. Kiểm Tra Code

Smart contract:

```bash
cd smart-contract
npx hardhat compile
npx hardhat test
```

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm run type-check
npm run lint
npm run build
```

Lưu ý: phải chạy các lệnh trong đúng thư mục con. Nếu chạy `npm` ở `/Users/tolinh` sẽ báo không tìm thấy `package.json`.

## 8. Lỗi Thường Gặp

### 8.1. Docker chưa mở

Lỗi:

```txt
failed to connect to the docker API
```

Cách xử lý:

- Mở Docker Desktop.
- Đợi Docker status là `Running`.
- Chạy lại:

```bash
./scripts/dev-docker.sh
```

### 8.2. MongoDB ECONNREFUSED khi chạy thủ công

Lỗi:

```txt
MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017
```

Cách xử lý nhanh nhất: dùng Docker dev.

```bash
./scripts/dev-docker.sh
```

Nếu vẫn muốn chạy thủ công:

```bash
brew services start mongodb-community
mongosh --quiet --eval "db.adminCommand({ ping: 1 })" mongodb://127.0.0.1:27017/certchain
```

### 8.3. Hardhat RPC ECONNREFUSED

Lỗi:

```txt
JsonRpcProvider failed to detect network
connect ECONNREFUSED 127.0.0.1:8545
```

Nguyên nhân: chưa chạy Hardhat node hoặc Docker hardhat chưa lên.

Docker:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f hardhat
```

Thủ công:

```bash
cd smart-contract
npx hardhat node
```

### 8.4. QR mở trên điện thoại không kết nối được

Nguyên nhân thường gặp: QR chứa `localhost`.

Điện thoại hiểu `localhost` là chính điện thoại, không phải máy Mac.

Cách xử lý:

1. Lấy IP máy Mac:

```bash
ipconfig getifaddr en0
```

2. Chạy Docker bằng script để tự set IP:

```bash
./scripts/dev-docker.sh
```

3. Nếu chạy thủ công, sửa env theo IP LAN ở mục 4.

### 8.5. File đã tồn tại

Lỗi:

```txt
A certificate with this file already exists
```

Nguyên nhân: PDF đó đã từng được cấp, hash SHA-256 trùng.

Cách xử lý:

- Upload PDF khác.
- Hoặc reset database dev:

```bash
docker compose -f docker-compose.dev.yml down -v
./scripts/dev-docker.sh
```

### 8.6. Hardhat local mất dữ liệu sau restart

Hardhat local blockchain là tạm thời. Nếu tắt Hardhat, dữ liệu on-chain mất.

Khi reset Hardhat, nên reset luôn MongoDB dev để dữ liệu không lệch:

```bash
docker compose -f docker-compose.dev.yml down -v
./scripts/dev-docker.sh
```

## 9. MetaMask Local Hardhat

Nếu muốn dùng MetaMask với Hardhat local:

Network:

```txt
Network name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

Import Hardhat account #0 bằng private key:

```txt
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Chỉ dùng account này cho local dev.

## 10. Kiến Trúc Tổng Quan

```txt
Người dùng / Admin
        |
        v
Next.js Frontend
        |
        v
Express Backend
   |        |        |
   v        v        v
MongoDB   IPFS    Smart Contract
                 CertRegistry.sol
                      |
                      v
              Hardhat / Ethereum
```

## 11. Lệnh Hay Dùng

Chạy Docker dev:

```bash
cd /Users/tolinh/Documents/Programming/blockchain/certchain
./scripts/dev-docker.sh
```

Xem trạng thái Docker:

```bash
docker compose -f docker-compose.dev.yml ps
```

Xem log:

```bash
docker compose -f docker-compose.dev.yml logs -f backend frontend hardhat mongodb
```

Dừng Docker:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset Docker dev:

```bash
docker compose -f docker-compose.dev.yml down -v
./scripts/dev-docker.sh
```

Seed admin:

```bash
curl -X POST http://localhost:5001/api/auth/seed
```

Health check:

```bash
curl -s http://localhost:5001/health
```
