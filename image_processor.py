import os
import hashlib
from PIL import Image
from pathlib import Path

PUBLIC_DIR = Path(__file__).resolve().parent / "public"
IMPORT_DIR = PUBLIC_DIR / "assets" / "reveal_images_import"
PROCESSED_DIR = PUBLIC_DIR / "assets" / "reveal_images"

def setup_directories():
    os.makedirs(IMPORT_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

def remove_green_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            
            # Chroma keying: detect dominant green pixels.
            # G must be above threshold and strictly greater than R and B.
            if g > 55 and g > r * 1.15 and g > b * 1.15:
                diff = g - max(r, b)
                if diff > 25:
                    pixels[x, y] = (r, g, b, 0)
                elif diff > 8:
                    # Smooth alpha transition at the edges
                    factor = (diff - 8) / 17.0
                    new_a = int(a * (1.0 - factor))
                    pixels[x, y] = (r, g, b, new_a)
                    
    return rgba

def make_square_and_resize(img: Image.Image, size: int = 512) -> Image.Image:
    width, height = img.size
    if width == height:
        square = img
    elif width > height:
        left = (width - height) // 2
        square = img.crop((left, 0, left + height, height))
    else:
        top = (height - width) // 2
        square = img.crop((0, top, width, top + width))
        
    return square.resize((size, size), Image.Resampling.LANCZOS)

def process_import_folder():
    setup_directories()
    supported_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    
    processed_any = False
    for item in os.listdir(IMPORT_DIR):
        file_path = IMPORT_DIR / item
        if not file_path.is_file():
            continue
            
        ext = file_path.suffix.lower()
        if ext not in supported_extensions:
            continue
            
        try:
            print(f"Processing imported image: {item}...")
            with Image.open(file_path) as img:
                # 1. Remove green background
                no_bg_img = remove_green_background(img)
                
                # 2. Crop to square (1:1) and resize for optimization
                final_img = make_square_and_resize(no_bg_img, size=512)
                
                # 3. Save as optimized WebP
                name_hash = hashlib.md5(item.encode("utf-8")).hexdigest()[:8]
                dest_filename = f"imported_{name_hash}.webp"
                dest_path = PROCESSED_DIR / dest_filename
                
                final_img.save(dest_path, "WEBP", quality=85)
                print(f"Saved optimized image to {dest_path}")
                
            # Delete processed original
            os.remove(file_path)
            processed_any = True
        except Exception as e:
            print(f"Error processing {item}: {e}")
            
    return processed_any
