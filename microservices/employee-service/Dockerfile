FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --progress=false; \
    else \
      npm install --omit=dev --no-audit --progress=false; \
    fi

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]