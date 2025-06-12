# client/Dockerfile

# Use a more recent Node image with Yarn pre-installed
FROM node:20-alpine AS base
WORKDIR /app

# ——— build-args come first ———
ARG NEXT_PUBLIC_API_URL
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST
ARG AUTH_SECRET
ARG AUTH_MICROSOFT_ENTRA_ID_ID
ARG AUTH_MICROSOFT_ENTRA_ID_SECRET

# Set environment variables
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_PORT=$DB_PORT
ENV DB_HOST=$DB_HOST
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_MICROSOFT_ENTRA_ID_ID=$AUTH_MICROSOFT_ENTRA_ID_ID
ENV AUTH_MICROSOFT_ENTRA_ID_SECRET=$AUTH_MICROSOFT_ENTRA_ID_SECRET

# Install dependencies
RUN apk add --no-cache libc6-compat
COPY package.json ./
RUN yarn install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Set additional environment variables
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
