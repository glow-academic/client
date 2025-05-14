# client/Dockerfile

# Use Node.js image without platform specification to match your host architecture
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
RUN apk add --no-cache libc6-compat
COPY package.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
