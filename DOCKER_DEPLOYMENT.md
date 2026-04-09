# 🐳 Docker Deployment Guide - CICJ-SH-COMS

## Overview

This guide covers containerization and deployment of the CICJ-SH-COMS application using Docker and various Platform-as-a-Service (PaaS) providers.

---

## 📦 What's Included

### Docker Files:

- **`backend/Dockerfile`** - Multi-stage production-optimized container image
- **`backend/.dockerignore`** - Excludes unnecessary files from build context
- **`docker-compose.yml`** - Production deployment with MySQL
- **`docker-compose.dev.yml`** - Development environment with hot-reloading
- **`backend/healthcheck.js`** - Container health monitoring script
- **`backend/.env.example`** - Environment variables template

---

## 🚀 Quick Start

### Local Development with Docker

```bash
# Start development environment (includes MySQL + phpMyAdmin)
docker-compose -f docker-compose.dev.yml up

# Access the application
# Backend API: http://localhost:5000
# phpMyAdmin: http://localhost:8080 (user: root, password: root)
```

### Production Deployment (Local Testing)

```bash
# Build and start production containers
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop containers
docker-compose down
```

---

## 🏗️ Dockerfile Architecture

### Multi-Stage Build Strategy:

**Stage 1: Builder (Development Tools)**
- Node.js 18 Alpine base
- All dependencies installed (including devDependencies)
- Prisma Client generated
- Full source code

**Stage 2: Production (Optimized Runtime)**
- Minimal Alpine base with dumb-init
- Production dependencies only (`npm ci --only=production`)
- Non-root user (nodejs:1001) for security
- Health check integration
- Optimized image size (~150MB vs 400MB+)

### Security Features:

✅ **Non-root user** - Runs as `nodejs` user (UID 1001)  
✅ **dumb-init** - Proper signal handling for graceful shutdowns  
✅ **Health checks** - `/health` endpoint with database ping  
✅ **Multi-stage build** - Excludes dev dependencies from production  
✅ **HEALTHCHECK directive** - Automatic container restart on failure  

---

## 🌐 PaaS Deployment Options

### Option 1: Render.com (Recommended)

**Why Render?**
- Free tier available
- Automatic HTTPS
- Managed MySQL database
- GitHub auto-deploy
- Zero DevOps required

**Deployment Steps:**

1. **Create Render Account** → [render.com](https://render.com)

2. **Create MySQL Database:**
   - Dashboard → New → PostgreSQL (or use external MySQL)
   - Note the `DATABASE_URL` (auto-generated)

3. **Create Web Service:**
   ```yaml
   # render.yaml (create in root directory)
   services:
     - type: web
       name: cicj-shcoms-backend
       env: docker
       dockerfilePath: ./backend/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: cicj-mysql
             property: connectionString
         - key: JWT_SECRET
           generateValue: true
         - key: PORT
           value: 5000
   ```

4. **Deploy:**
   - Connect GitHub repository
   - Render auto-detects Dockerfile
   - Set environment variables in dashboard
   - Deploy triggers automatically on `git push`

**Render Pricing:**
- Free tier: 750 hours/month
- Starter: $7/month (recommended for production)

---

### Option 2: Railway.app

**Why Railway?**
- $5 free credit monthly
- One-click MySQL provisioning
- GitHub integration
- Simple CLI deployment

**Deployment Steps:**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd "C:\Users\kianb\Documents\CICJ-ICMS (NEW)"
railway init

# Add MySQL database
railway add

# Deploy
railway up
```

**Environment Variables (Auto-injected):**
- `DATABASE_URL` - Auto-configured by Railway
- `PORT` - Auto-assigned by platform
- `JWT_SECRET` - Set manually in dashboard

**Railway Pricing:**
- Free: $5 credit/month (~50 hours)
- Pro: $20/month

---

### Option 3: Fly.io

**Why Fly.io?**
- Global edge deployment
- 3GB free persistent storage
- Automatic scaling
- Machine-level control

**Deployment Steps:**

```bash
# Install flyctl
# Windows: iwr https://fly.io/install.ps1 -useb | iex

# Login
fly auth login

# Launch app (creates fly.toml)
cd "C:\Users\kianb\Documents\CICJ-ICMS (NEW)\backend"
fly launch

# Create MySQL volume
fly volumes create mysql_data --size 3

# Deploy
fly deploy
```

**fly.toml** (auto-generated):
```toml
app = "cicj-shcoms-backend"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[[services]]
  internal_port = 5000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

**Fly.io Pricing:**
- Free: 3 shared-cpu VMs
- Paid: $1.94/month per VM

---

### Option 4: Heroku

**Why Heroku?**
- Industry standard
- Extensive add-ons ecosystem
- Auto-scaling
- Enterprise support

**Deployment Steps:**

```bash
# Install Heroku CLI
# Windows: Download from https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create cicj-shcoms-backend

# Add MySQL (ClearDB add-on)
heroku addons:create cleardb:ignite

# Get database URL
heroku config:get CLEARDB_DATABASE_URL

# Set environment variables
heroku config:set JWT_SECRET=your_secret_here
heroku config:set DATABASE_URL=mysql://...

# Deploy
git push heroku main
```

**Heroku Pricing:**
- Eco: $5/month (sleeps after 30min inactivity)
- Basic: $7/month (no sleep)
- Standard: $25/month (autoscaling)

---

### Option 5: DigitalOcean App Platform

**Why DigitalOcean?**
- Predictable pricing
- Managed databases
- Built-in monitoring
- Direct Docker support

**Deployment Steps:**

1. **Create App** → [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. **Connect GitHub repository**
3. **Select Dockerfile** (`backend/Dockerfile`)
4. **Add Managed MySQL Database:**
   - Database type: MySQL 8
   - Size: Basic ($15/month)
5. **Set Environment Variables:**
   ```
   DATABASE_URL=${db.DATABASE_URL}
   JWT_SECRET=your_secret_here
   PORT=8080
   ```
6. **Deploy**

**DigitalOcean Pricing:**
- Basic: $5/month (512MB RAM)
- Professional: $12/month (1GB RAM)
- Database: $15/month (managed MySQL)

---

## 🔧 Docker Commands Reference

### Building Images:

```bash
# Build production image
docker build -t cicj-shcoms-backend ./backend

# Build with specific tag
docker build -t cicj-shcoms-backend:v1.0.0 ./backend

# Build without cache (force rebuild)
docker build --no-cache -t cicj-shcoms-backend ./backend
```

### Running Containers:

```bash
# Run with environment file
docker run -p 5000:5000 --env-file ./backend/.env cicj-shcoms-backend

# Run in detached mode
docker run -d -p 5000:5000 --name cicj-backend cicj-shcoms-backend

# Run with custom environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL="mysql://user:pass@host:3306/db" \
  -e JWT_SECRET="secret" \
  cicj-shcoms-backend
```

### Container Management:

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs cicj-backend

# Follow logs (real-time)
docker logs -f cicj-backend

# Stop container
docker stop cicj-backend

# Remove container
docker rm cicj-backend

# Remove image
docker rmi cicj-shcoms-backend
```

### Docker Compose:

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Rebuild images before starting
docker-compose up --build

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# View logs for specific service
docker-compose logs app

# Execute command in running container
docker-compose exec app npx prisma migrate deploy
```

---

## 🧪 Testing the Container

### 1. Build Test:

```bash
cd "C:\Users\kianb\Documents\CICJ-ICMS (NEW)\backend"
docker build -t cicj-test .
```

**Expected Output:**
```
[+] Building 45.2s (18/18) FINISHED
 => [builder 1/6] FROM docker.io/library/node:18-alpine
 => [builder 2/6] COPY package*.json ./
 => [builder 3/6] RUN npm ci
 => [builder 4/6] RUN npx prisma generate
 => [production 1/8] RUN apk add --no-cache dumb-init
 => [production 5/8] COPY --from=builder /app/node_modules/.prisma
 => exporting to image
 => => naming to docker.io/library/cicj-test
```

### 2. Health Check Test:

```bash
# Start container
docker run -d -p 5000:5000 --name cicj-test \
  -e DATABASE_URL="mysql://root:@localhost:3306/cicj_shcoms" \
  -e JWT_SECRET="test_secret" \
  cicj-test

# Wait 30 seconds for startup
timeout /t 30

# Check health status
docker inspect --format='{{json .State.Health}}' cicj-test

# Test health endpoint
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-08T10:30:00.000Z",
  "uptime": 28.5,
  "database": "connected"
}
```

### 3. Prisma Migration Test:

```bash
# Access container shell
docker exec -it cicj-test sh

# Inside container
npx prisma migrate deploy
npx prisma db seed

# Exit
exit
```

---

## 🔐 Environment Variables for PaaS

### Required Variables:

| Variable | Description | Example | Platform Auto-Inject |
|----------|-------------|---------|---------------------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` | ✅ Render, Railway, Heroku |
| `JWT_SECRET` | JWT signing key | `cicj_super_secret_key_2026` | ❌ Manual |
| `PORT` | Server port | `5000` or `8080` | ✅ Most platforms |
| `NODE_ENV` | Environment mode | `production` | ❌ Set to `production` |

### Optional Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed origins | `*` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `MAX_FILE_SIZE` | Upload limit (MB) | `10` |
| `SESSION_SECRET` | Session encryption key | `auto-generated` |

---

## 📊 Image Size Optimization

### Before Optimization:
```
node:18 (full)         → 900MB
+ npm install         → +250MB
+ source code         → +10MB
Total: ~1160MB
```

### After Multi-Stage Build:
```
node:18-alpine        → 120MB
+ production deps     → +25MB
+ Prisma client      → +15MB
+ source code        → +5MB
Total: ~165MB (85% reduction)
```

---

## 🛠️ Troubleshooting

### Issue: "Prisma Client not found"

**Solution:**
```dockerfile
# Ensure Prisma generation in Dockerfile
RUN npx prisma generate

# Copy generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
```

### Issue: "Database connection refused"

**Solution:**
```bash
# Check DATABASE_URL format
# Correct: mysql://user:pass@host:3306/database
# Wrong: mysql://user:pass@localhost:3306/database (use container name)

# For docker-compose, use service name:
DATABASE_URL="mysql://user:pass@mysql:3306/cicj_shcoms"
```

### Issue: "EACCES: permission denied"

**Solution:**
```dockerfile
# Ensure proper file ownership
COPY --chown=nodejs:nodejs . .

# Check file permissions
USER nodejs
```

### Issue: Container keeps restarting

**Solution:**
```bash
# Check health check logs
docker logs cicj-backend

# Inspect health status
docker inspect cicj-backend | grep -A 5 Health

# Disable health check temporarily for debugging
docker run --no-healthcheck cicj-shcoms-backend
```

---

## 🚦 CI/CD Integration

### GitHub Actions Example:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker Image
        run: docker build -t CICJ-SH-COMS ./backend
      
      - name: Run tests
        run: docker run CICJ-SH-COMS npm test
      
      - name: Deploy to Render
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

---

## 📈 Scaling Considerations

### Horizontal Scaling (Multiple Instances):

```yaml
# docker-compose with replicas
services:
  app:
    deploy:
      replicas: 3
    # ... rest of config
```

### Load Balancing (nginx):

```nginx
upstream backend {
    server app1:5000;
    server app2:5000;
    server app3:5000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

### Database Connection Pooling:

```javascript
// Prisma with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=10&pool_timeout=20"
    }
  }
});
```

---

## ✅ Pre-Deployment Checklist

- [ ] Environment variables configured (`.env.example` → `.env`)
- [ ] `JWT_SECRET` changed to strong random string
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Admin user seeded (`npx prisma db seed`)
- [ ] Health check endpoint tested (`/health`)
- [ ] Docker build succeeds without errors
- [ ] Container runs and responds to requests
- [ ] CORS origins configured for production domain
- [ ] Secure password hashing enabled (bcrypt)
- [ ] File upload limits set appropriately
- [ ] Logging configured for production

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Render Deployment Guide](https://render.com/docs/deploy-node-express-app)
- [Railway Documentation](https://docs.railway.app/)
- [Fly.io Documentation](https://fly.io/docs/)

---

**Task 3 Complete:** Docker containerization ready for agile PaaS deployment! 🎉
