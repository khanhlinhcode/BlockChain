FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY contracts ./contracts
COPY scripts ./scripts
COPY hardhat.config.js ./

EXPOSE 8545

CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
