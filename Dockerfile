# Stage 1: Build the Meteor app
FROM geoffreybooth/meteor-base:3.5.2 AS builder

COPY . /app
RUN cd /app && meteor npm install --production
RUN cd /app && meteor build --directory /opt/meteor

# Stage 2: Create the production runtime image
FROM node:24.15.0-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy the built bundle from Stage 1
COPY --from=builder /opt/meteor/bundle /app

# Install production binary dependencies
RUN cd /app/programs/server && npm install --production

EXPOSE 3000
CMD ["node", "main.js"]

