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

# Start server
CMD ["node", "server.js"]