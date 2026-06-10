FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY disparesms-api-clean/package*.json ./
COPY disparesms-api-clean/prisma ./prisma/

RUN npm ci || npm install

COPY disparesms-api-clean/ .

RUN npx prisma generate
RUN npm run build

RUN ls -la dist/ || echo "dist not found"

EXPOSE 3001

CMD sh -c "npx prisma migrate deploy && node \$(find /app/dist -name main.js | head -n 1)"
