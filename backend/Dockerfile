FROM node:20-slim

WORKDIR /app

# Install system dependencies for Python + WeasyPrint + reportlab
# - python3, pip: for Python scripts
# - WeasyPrint runtime deps: pango, cairo, gdk-pixbuf, harfbuzz
# - shared-mime-info: for proper font/image type detection
# - fonts-thai-tlwg: Thai system fonts (fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libharfbuzz0b \
    libffi-dev \
    shared-mime-info \
    fonts-thai-tlwg \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages — keep reportlab for backward compat (other scripts use it)
RUN pip3 install --no-cache-dir --break-system-packages \
    reportlab \
    weasyprint

COPY package.json ./
RUN npm install --only=production

COPY src/ ./src/

EXPOSE 4000
CMD ["node", "src/index.js"]
