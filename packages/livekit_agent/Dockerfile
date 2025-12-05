FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml .
COPY main.py .

# Install Python dependencies
RUN pip install --no-cache-dir .

# Run the agent
CMD ["python", "main.py", "start"]
