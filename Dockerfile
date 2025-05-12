FROM node:24-alpine as builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine as production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Set execution permissions
RUN chmod +x ./dist/index.js

# Environment variables
ENV NODE_ENV=production

ENV PORT=3000

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "dist/index.js"] 