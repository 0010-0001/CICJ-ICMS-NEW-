FROM node:20-alpine

WORKDIR /app

# Copy entire project (Express serves static HTML/CSS/JS via express.static)
COPY . .

# Install backend dependencies and generate Prisma client
RUN cd backend && npm install && npx prisma generate

EXPOSE 8080

CMD ["node", "backend/server.js"]
