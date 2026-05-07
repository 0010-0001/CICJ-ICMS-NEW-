FROM node:20-slim

WORKDIR /app

# Install openssl BEFORE prisma generate so the engine binary targets the correct OpenSSL version
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy entire project (Express serves static HTML/CSS/JS via express.static)
COPY . .

# ARG is build-time only — not baked into the image, so Railway's runtime vars are not blocked.
ARG DATABASE_URL=mysql://build:build@build:3306/build

RUN cd backend && npm install && DATABASE_URL="${DATABASE_URL}" npx prisma generate

EXPOSE 8080

CMD ["sh", "-c", "cd /app/backend && npx prisma migrate deploy && cd /app && node backend/server.js"]
