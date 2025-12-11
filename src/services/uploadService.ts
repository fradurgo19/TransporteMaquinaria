import { supabase } from './supabase';

/**
 * Servicio para subir archivos a Supabase Storage
 */

export type BucketType = 'fuel-receipts' | 'operation-photos' | 'checklist-photos' | 'runt-images';

/**
 * Subir archivo a Supabase Storage
 */
export const uploadFile = async (
  file: File,
  bucket: BucketType,
  folder?: string
): Promise<{ url: string; path: string } | null> => {
  try {
    // Generar nombre único
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${extension}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    console.log(`📤 Subiendo archivo a ${bucket}/${filePath}...`);

    // Subir archivo
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error subiendo archivo:', error);
      throw error;
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('✅ Archivo subido:', publicUrl);

    return {
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Error en uploadFile:', error);
    return null;
  }
};

/**
 * Eliminar archivo de Supabase Storage
 */
export const deleteFile = async (
  bucket: BucketType,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Error eliminando archivo:', error);
      return false;
    }

    console.log('✅ Archivo eliminado:', filePath);
    return true;
  } catch (error) {
    console.error('Error en deleteFile:', error);
    return false;
  }
};

/**
 * Obtener URL firmada (signed URL) para archivos privados
 */
export const getSignedUrl = async (
  bucket: BucketType,
  filePath: string,
  expiresIn: number = 3600 // 1 hora por defecto
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error obteniendo signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error en getSignedUrl:', error);
    return null;
  }
};

/**
 * Comprimir imagen antes de subir (opcional, para optimizar tamaño)
 */
export const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Redimensionar si es muy grande
        let width = img.width;
        let height = img.height;
        const maxSize = 1920;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8 // Calidad 80%
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

