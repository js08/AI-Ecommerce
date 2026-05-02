# Step 1: Use Node image to build the app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build it
COPY . .
RUN npm run build

# Step 2: Run the app using a slim image
FROM node:18-alpine

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Open the port your app runs on
EXPOSE 8082

# Start the server
CMD ["npm", "run", "start:prod"]