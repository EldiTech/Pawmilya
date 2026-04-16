export const DEFAULT_BASE64_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAADICAIAAADdvUsCAAAEkklEQVR4nO3TMQEAIAzAsIF/z0NGDxIFfXp2ZgdA9t4OAPxkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0j2AmMGBRp5wh2YAAAAAElFTkSuQmCC';

export const normalizeImageUrl = (imagePath, fallback = DEFAULT_BASE64_IMAGE) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return fallback;
  }

  const value = imagePath.trim();

  if (!value) {
    return fallback;
  }

  if (value.startsWith('data:image/')) {
    return value;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('file://') || value.startsWith('/')) {
    return value;
  }

  return fallback;
};
