FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY dist ./dist/
RUN mkdir -p uploads uploads/proofs uploads/webhook
EXPOSE 3001
CMD ["node", "dist/index.js"]
