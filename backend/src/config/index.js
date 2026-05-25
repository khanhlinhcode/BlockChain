module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },

  blockchain: {
    alchemyUrl: process.env.ALCHEMY_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY,
    chainId: 11155111,
  },

  ipfs: {
    apiKey: process.env.PINATA_API_KEY,
    secretKey: process.env.PINATA_SECRET_KEY,
    gateway: process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs",
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || "CertChain <onboarding@resend.dev>",
  },

  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
    prodUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL || "",
  },
};
