FROM node:20-slim

WORKDIR /app

# Copy entire project (Express serves static HTML/CSS/JS via express.static)
COPY . .

# ARG is build-time only — not baked into the image, so Railway's runtime vars are not blocked.
ARG DATABASE_URL=mysql://build:build@build:3306/build

RUN cd backend && npm install && DATABASE_URL="${DATABASE_URL}" npx prisma generate
# Install openssl for Prisma compatibility on slim/debian base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

CMD ["node", "backend/server.js"]
