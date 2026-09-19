FROM python:3.12-slim

WORKDIR /opt/icp-agent

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9100

CMD ["python", "-m", "uvicorn", "icp_agent.main:app", "--host", "0.0.0.0", "--port", "9100"]
