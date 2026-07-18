FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir Pillow

# Copy the server scripts and the public assets
COPY server.py werwolf_backend.py image_processor.py ./
COPY public/ ./public/

EXPOSE 8080

# Run the python server
CMD ["python", "server.py"]
