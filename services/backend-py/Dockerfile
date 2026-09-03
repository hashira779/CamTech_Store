# 2026-2030 Enterprise Python Backend Microservice Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (build-essential, postgres client, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Set Python environment
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose default API Gateway port
EXPOSE 4000

# Default command runs the API Gateway on port 4000
CMD ["python", "-m", "uvicorn", "app.microservices.gateway:gateway", "--host", "0.0.0.0", "--port", "4000"]
