FROM node:20-alpine
WORKDIR /app

# Install Python + reportlab for PDF generation
RUN apk add --no-cache python3 py3-pip py3-pillow && \
    pip3 install --break-system-packages reportlab

COPY package.json ./
RUN npm install --only=production
COPY src/ ./src/
EXPOSE 4000
CMD ["node", "src/index.js"]
