# 1. Start with a tiny version of Node.js (Alpine Linux) 
# This keeps the image size small (around 50MB instead of 900MB).
FROM node:18-alpine

# 2. Define the "Home Folder" inside the container
# All our code will be placed here to keep it organized.
WORKDIR /app

# 3. Copy the 'package.json' and 'package-lock.json' first
# Docker caches this step. If you don't change your tools, 
# Docker won't re-download them every time you change your code.
COPY package*.json ./

# 4. Run the installer to download Express and the Proxy tools
# '--production' ensures we don't install testing tools we don't need in the "live" store.
RUN npm install --production

# 5. Copy your 'index.js' and other gateway files into the container
COPY . .

# 6. Tell Docker that this container listens on Port 8080
# This is like telling the "City Map" where the entrance to this building is.
EXPOSE 8080

# 7. Start the Gateway using the command we defined in package.json
# This keeps the "Receptionist" awake and waiting for user requests.
CMD ["npm", "start"]