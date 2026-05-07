FROM node:20-slim

WORKDIR /app

# Copy entire project (Express serves static HTML/CSS/JS via express.static)
COPY . .

# Dummy DATABASE_URL for prisma generate (no DB connection made during generate).
# Railway's real DATABASE_URL env var overrides this at container runtime.
ENV DATABASE_URL="mysql://build:build@build:3306/build"

RUN cd backend && npm install && npx prisma generate

EXPOSE 8080

CMD ["node", "backend/server.js"]
