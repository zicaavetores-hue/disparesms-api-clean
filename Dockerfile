FROM node:20-alpine

WORKDIR /app

COPY disparesms-api-clean/package*.json ./
COPY disparesms-api-clean/prisma ./prisma/

RUN npm install

COPY disparesms-api-clean/ .

RUN npx prisma generate
RUN npm run build

RUN ls -la dist/ || echo "dist not found"

EXPOSE 3001

CMD ["node", "/app/dist/main"]
