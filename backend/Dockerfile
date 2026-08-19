# Use Debian-based Node image
FROM node:18

# Set working directory
WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y build-essential python3

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies (bcrypt will compile for this container)
RUN npm install --build-from-source

# Copy the rest of the backend code
COPY . .

# Expose backend port
EXPOSE 5000

# Health check — Docker will mark container unhealthy if /health fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start server
CMD ["node", "server.js"]