FROM python:3.11-slim

WORKDIR /app

# Copy the server scripts and the public assets
COPY server.py werwolf_backend.py ./
COPY public/ ./public/

EXPOSE 8080

# Run the python server
CMD ["python", "server.py"]
