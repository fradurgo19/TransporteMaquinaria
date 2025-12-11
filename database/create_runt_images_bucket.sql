-- ============================================
-- SCRIPT: Crear bucket de Storage para imágenes RUNT
-- ============================================
-- Este script crea el bucket 'runt-images' en Supabase Storage
-- para almacenar las imágenes del RUNT de las máquinas
-- ============================================
-- 
-- NOTA: Este script debe ejecutarse en Supabase Dashboard > Storage
-- o usando la API de Supabase Storage
-- ============================================

-- Crear bucket 'runt-images' si no existe
-- Esto se hace a través de la API de Supabase Storage o el Dashboard
-- 
-- Pasos para crear el bucket manualmente:
-- 1. Ir a Supabase Dashboard > Storage
-- 2. Click en "New bucket"
-- 3. Nombre: "runt-images"
-- 4. Public: true (para que las imágenes sean accesibles públicamente)
-- 5. File size limit: 10 MB (o el tamaño que prefieras)
-- 6. Allowed MIME types: image/jpeg, image/png, image/webp
--
-- O usar la API de Supabase Storage:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'runt-images',
--   'runt-images',
--   true,
--   10485760, -- 10 MB
--   ARRAY['image/jpeg', 'image/png', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para el bucket 'runt-images'
-- Permitir lectura pública (para que las imágenes sean accesibles)
CREATE POLICY IF NOT EXISTS "Public Access for RUNT images"
ON storage.objects FOR SELECT
USING (bucket_id = 'runt-images');

-- Permitir inserción a usuarios autenticados
CREATE POLICY IF NOT EXISTS "Authenticated users can upload RUNT images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'runt-images' 
  AND auth.role() = 'authenticated'
);

-- Permitir actualización a usuarios autenticados (solo sus propias imágenes)
CREATE POLICY IF NOT EXISTS "Authenticated users can update RUNT images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'runt-images' 
  AND auth.role() = 'authenticated'
);

-- Permitir eliminación a usuarios autenticados (solo sus propias imágenes)
CREATE POLICY IF NOT EXISTS "Authenticated users can delete RUNT images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'runt-images' 
  AND auth.role() = 'authenticated'
);

-- Comentario
COMMENT ON POLICY "Public Access for RUNT images" ON storage.objects IS 
'Permite acceso público de lectura a las imágenes del RUNT almacenadas en el bucket runt-images';

COMMENT ON POLICY "Authenticated users can upload RUNT images" ON storage.objects IS 
'Permite a usuarios autenticados subir imágenes del RUNT al bucket runt-images';

COMMENT ON POLICY "Authenticated users can update RUNT images" ON storage.objects IS 
'Permite a usuarios autenticados actualizar imágenes del RUNT en el bucket runt-images';

COMMENT ON POLICY "Authenticated users can delete RUNT images" ON storage.objects IS 
'Permite a usuarios autenticados eliminar imágenes del RUNT del bucket runt-images';

