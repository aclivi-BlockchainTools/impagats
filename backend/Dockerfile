FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY dist ./dist/
RUN mkdir -p storage/proofs
EXPOSE 3001
ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
