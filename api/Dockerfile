FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install everything else from /api into 
COPY . .

# Listening on Port 8000
EXPOSE 8000

# On container start, launch FastAPI server so it listens for outside requests on Render's port (fallback to 8000)
CMD ["sh", "-c", "uvicorn index:app --host 0.0.0.0 --port ${PORT:-8000}"]
