# client/Dockerfile

# Use a more recent Node image with Yarn pre-installed
FROM node:20-alpine AS base
WORKDIR /app

# ——— build-arg comes first ———
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Install dependencies
RUN apk add --no-cache libc6-compat
COPY package.json ./
RUN yarn install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# # Run Jest tests
# RUN npm test

# # Install Cypress dependencies and run Cypress tests
# # Cypress requires additional dependencies on Alpine
# RUN apk add --no-cache xvfb-run firefox dbus eudev ttf-freefont udev

# # Run Cypress tests in headless mode
# RUN npx cypress run

# Build the application
RUN yarn build

# Expose the port
EXPOSE 3000

# Start the application with drizzle-kit pull first
CMD ["sh", "-c", "npx drizzle-kit pull && yarn start"]
