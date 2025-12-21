FROM alpine:latest

# Install curl, bash, and jq for JSON parsing
RUN apk add --no-cache curl bash jq

# Copy notify script
COPY notify.sh /notify.sh

# Make script executable
RUN chmod +x /notify.sh

# Set working directory
WORKDIR /

# Run notify service
CMD ["/notify.sh"]

