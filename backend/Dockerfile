FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma/
COPY dist ./dist/
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/index.js"]
