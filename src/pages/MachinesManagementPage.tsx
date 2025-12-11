import React, { useState, useRef } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { DataTable } from '../organisms/DataTable';
import { Upload, Camera, Wand2, Loader, X, Save, Edit2, Trash2 } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { useRUNTOCR } from '../hooks/useRUNTOCR';
import { supabase } from '../services/supabase';
import { useMachines, useInvalidateMachines, Machine } from '../hooks/useMachines';
import { uploadFile, compressImage } from '../services/uploadService';
import { useQueryClient } from '@tanstack/react-query';

export const MachinesManagementPage: React.FC = () => {
  useProtectedRoute(['admin', 'admin_logistics']);
  const { user } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [runtImage, setRuntImage] = useState<File | null>(null);
  const [runtPreview, setRuntPreview] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Machine>>({});
  const [uploadingImageForId, setUploadingImageForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const { extractDataFromRUNT, isProcessing: ocrProcessing, progress } = useRUNTOCR();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Usar React Query para cargar máquinas con refetch automático
  const { data: machines = [], isLoading, refetch: refetchMachines } = useMachines();
  const invalidateMachines = useInvalidateMachines();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRuntImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setRuntPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const processRUNTImage = async () => {
    if (!runtImage) {
      alert('Por favor, selecciona una imagen del RUNT');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🔍 Procesando imagen del RUNT con OCR...');
      const ocrResult = await extractDataFromRUNT(runtImage);

      console.log('📋 Datos extraídos:', ocrResult);

      // Mostrar los datos extraídos para confirmación
      const confirmed = window.confirm(
        `Datos extraídos:\n\n` +
        `Serie: ${ocrResult.serie || 'No encontrado'}\n` +
        `Descripción: ${ocrResult.descripcion || 'No encontrado'}\n` +
        `Marca: ${ocrResult.marca || 'No encontrado'}\n` +
        `Línea: ${ocrResult.linea || 'No encontrado'}\n` +
        `Modelo (año): ${ocrResult.modelo || 'No encontrado'}\n` +
        `Ancho: ${ocrResult.ancho || 'No encontrado'} m\n` +
        `Alto: ${ocrResult.alto || 'No encontrado'} m\n` +
        `Largo: ${ocrResult.largo || 'No encontrado'} m\n` +
        `Peso: ${ocrResult.peso || 'No encontrado'} kg\n` +
        `1. Número único de identificación: ${ocrResult.numero_identificacion || 'No encontrado'}\n` +
        `Clase: ${ocrResult.clase || 'No encontrado'}\n` +
        `Nro. Chasis: ${ocrResult.numero_chasis || 'No encontrado'}\n` +
        `Nro. Motor: ${ocrResult.numero_motor || 'No encontrado'}\n` +
        `Cilindraje: ${ocrResult.cilindraje || 'No encontrado'} cc\n` +
        `Rodaje: ${ocrResult.rodaje || 'No encontrado'}\n` +
        `10. Estado del vehículo: ${ocrResult.estado_vehiculo || 'No encontrado'}\n` +
        `2. Nro. de identificación o serie del GPS: ${ocrResult.numero_serie_gps || 'No encontrado'}\n` +
        `3. Nro. de IMEI del GPS: ${ocrResult.numero_imei_gps || 'No encontrado'}\n` +
        `Subpartida Arancelaria: ${ocrResult.subpartida_arancelaria || 'No encontrado'}\n` +
        `11. Empresa de habilitación del Dispositivo GPS: ${ocrResult.empresa_gps || 'No encontrado'}\n\n` +
        `¿Deseas guardar estos datos?`
      );

      if (!confirmed) {
        setIsProcessing(false);
        return;
      }

      // Validar que haya serie (requerido)
      if (!ocrResult.serie) {
        alert('⚠️ No se pudo extraer la serie. Por favor, verifica la imagen o ingresa los datos manualmente.');
        setIsProcessing(false);
        return;
      }

      // Subir imagen del RUNT a Supabase Storage (OBLIGATORIO)
      let runtImageUrl: string | null = null;
      if (!runtImage) {
        alert('⚠️ Debes subir una imagen del RUNT para continuar');
        setIsProcessing(false);
        return;
      }

      console.log('📤 Subiendo imagen del RUNT a Storage...');
      try {
        const compressed = await compressImage(runtImage);
        const upload = await uploadFile(
          compressed,
          'runt-images',
          `machines/${ocrResult.serie.toUpperCase()}_${Date.now()}`
        );
        
        if (!upload || !upload.url) {
          throw new Error('No se pudo obtener la URL de la imagen subida');
        }
        
        runtImageUrl = upload.url;
        console.log('✅ Imagen del RUNT subida exitosamente:', runtImageUrl);
      } catch (uploadError) {
        console.error('❌ Error subiendo imagen del RUNT:', uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Error desconocido';
        alert(`❌ Error al subir la imagen del RUNT: ${errorMessage}\n\nPor favor, verifica que el bucket 'runt-images' esté configurado en Supabase Storage.`);
        setIsProcessing(false);
        return;
      }

      // Verificar si la serie ya existe
      const existing = machines.find(m => m.serie.toUpperCase() === ocrResult.serie.toUpperCase());
      if (existing) {
        const update = window.confirm(
          `La serie ${ocrResult.serie} ya existe. ¿Deseas actualizar el registro?`
        );
        
        if (update) {
          // Actualizar registro existente
          const { error } = await supabase
            .from('machines')
            .update({
              descripcion: ocrResult.descripcion || existing.descripcion,
              marca: ocrResult.marca || existing.marca,
              modelo: ocrResult.linea || ocrResult.modelo || existing.modelo, // Usar línea como modelo
              ancho: ocrResult.ancho ? parseFloat(ocrResult.ancho) : existing.ancho,
              alto: ocrResult.alto ? parseFloat(ocrResult.alto) : existing.alto,
              largo: ocrResult.largo ? parseFloat(ocrResult.largo) : existing.largo,
              peso: ocrResult.peso ? parseFloat(ocrResult.peso) : existing.peso,
              // Nuevos campos adicionales
              numero_identificacion: ocrResult.numero_identificacion || existing.numero_identificacion || null,
              numero_serie_gps: ocrResult.numero_serie_gps || existing.numero_serie_gps || null,
              numero_imei_gps: ocrResult.numero_imei_gps || existing.numero_imei_gps || null,
              clase: ocrResult.clase || existing.clase || null,
              cilindraje: ocrResult.cilindraje ? parseInt(ocrResult.cilindraje) : existing.cilindraje || null,
              numero_motor: ocrResult.numero_motor || existing.numero_motor || null,
              numero_chasis: ocrResult.numero_chasis || existing.numero_chasis || null,
              subpartida_arancelaria: ocrResult.subpartida_arancelaria || existing.subpartida_arancelaria || null,
              rodaje: ocrResult.rodaje || existing.rodaje || null,
              estado_vehiculo: ocrResult.estado_vehiculo || existing.estado_vehiculo || null,
              empresa_gps: ocrResult.empresa_gps || existing.empresa_gps || null,
              runt_image_url: runtImageUrl || existing.runt_image_url || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select();

          if (error) throw error;
          alert('✅ Máquina actualizada exitosamente');
        }
      } else {
        // Crear nuevo registro
        const { error } = await supabase
          .from('machines')
          .insert([{
            serie: ocrResult.serie.toUpperCase(),
            descripcion: ocrResult.descripcion || '',
            marca: ocrResult.marca || '',
            modelo: ocrResult.linea || ocrResult.modelo || null, // Usar línea como modelo
            ancho: ocrResult.ancho ? parseFloat(ocrResult.ancho) : null,
            alto: ocrResult.alto ? parseFloat(ocrResult.alto) : null,
            largo: ocrResult.largo ? parseFloat(ocrResult.largo) : null,
            peso: ocrResult.peso ? parseFloat(ocrResult.peso) : null,
            // Nuevos campos adicionales
            numero_identificacion: ocrResult.numero_identificacion || null,
            numero_serie_gps: ocrResult.numero_serie_gps || null,
            numero_imei_gps: ocrResult.numero_imei_gps || null,
            clase: ocrResult.clase || null,
            cilindraje: ocrResult.cilindraje ? parseInt(ocrResult.cilindraje) : null,
            numero_motor: ocrResult.numero_motor || null,
            numero_chasis: ocrResult.numero_chasis || null,
            subpartida_arancelaria: ocrResult.subpartida_arancelaria || null,
            rodaje: ocrResult.rodaje || null,
            estado_vehiculo: ocrResult.estado_vehiculo || null,
            empresa_gps: ocrResult.empresa_gps || null,
            runt_image_url: runtImageUrl || null,
            created_by: user?.id,
          }])
          .select();

        if (error) throw error;
        alert('✅ Máquina registrada exitosamente');
      }

      // Limpiar
      setRuntImage(null);
      setRuntPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Invalidar cache y refrescar
      invalidateMachines();
      refetchMachines();
    } catch (error: unknown) {
      console.error('Error procesando imagen:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setEditData(machine);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('machines')
        .update({
          serie: editData.serie,
          descripcion: editData.descripcion,
          marca: editData.marca,
          modelo: editData.modelo,
          ancho: editData.ancho,
          alto: editData.alto,
          largo: editData.largo,
          peso: editData.peso,
          // Nuevos campos adicionales
          numero_identificacion: editData.numero_identificacion || null,
          numero_serie_gps: editData.numero_serie_gps || null,
          numero_imei_gps: editData.numero_imei_gps || null,
          clase: editData.clase || null,
          cilindraje: editData.cilindraje || null,
          numero_motor: editData.numero_motor || null,
          numero_chasis: editData.numero_chasis || null,
          subpartida_arancelaria: editData.subpartida_arancelaria || null,
          rodaje: editData.rodaje || null,
          estado_vehiculo: editData.estado_vehiculo || null,
          empresa_gps: editData.empresa_gps || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .select();

      if (error) throw error;
      
      alert('✅ Máquina actualizada exitosamente');
      setEditingId(null);
      setEditData({});
      // Invalidar cache y refrescar
      invalidateMachines();
      refetchMachines();
    } catch (error: unknown) {
      console.error('Error actualizando:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, machine: Machine) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImageForId(machine.id);

    try {
      console.log(`📤 Subiendo imagen del RUNT para máquina ${machine.serie}...`);
      
      const compressed = await compressImage(file);
      const upload = await uploadFile(
        compressed,
        'runt-images',
        `machines/${machine.serie.toUpperCase()}_${Date.now()}`
      );

      if (!upload || !upload.url) {
        throw new Error('No se pudo obtener la URL de la imagen subida');
      }

      // Actualizar el registro con la nueva URL de imagen
      const { error } = await supabase
        .from('machines')
        .update({
          runt_image_url: upload.url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', machine.id)
        .select();

      if (error) throw error;

      alert('✅ Imagen del RUNT subida exitosamente');
      
      // Limpiar el input
      if (imageUploadRefs.current[machine.id]) {
        imageUploadRefs.current[machine.id]!.value = '';
      }

      // Invalidar cache y refrescar
      invalidateMachines();
      refetchMachines();
    } catch (error: unknown) {
      console.error('Error subiendo imagen:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al subir la imagen: ${errorMessage}`);
    } finally {
      setUploadingImageForId(null);
    }
  };

  const handleDelete = async (machine: Machine) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la máquina con serie "${machine.serie}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setDeletingId(machine.id);

    try {
      // Eliminar la imagen del storage si existe
      if (machine.runt_image_url) {
        try {
          // Extraer la ruta del archivo de la URL
          // La URL puede ser: https://[project].supabase.co/storage/v1/object/public/runt-images/machines/...
          const urlParts = machine.runt_image_url.split('/');
          const machinesIndex = urlParts.findIndex(part => part === 'machines');
          
          if (machinesIndex !== -1) {
            // Obtener todo después de 'machines'
            const filePath = urlParts.slice(machinesIndex).join('/');
            
            if (filePath) {
              console.log(`🗑️ Eliminando imagen del storage: ${filePath}`);
              const { error: deleteError } = await supabase.storage
                .from('runt-images')
                .remove([filePath]);

              if (deleteError) {
                console.warn('⚠️ No se pudo eliminar la imagen del storage:', deleteError);
                // Continuar con la eliminación del registro aunque falle la eliminación de la imagen
              } else {
                console.log('✅ Imagen eliminada del storage');
              }
            }
          } else {
            console.warn('⚠️ No se pudo extraer la ruta del archivo de la URL:', machine.runt_image_url);
          }
        } catch (storageError) {
          console.warn('⚠️ Error al eliminar imagen del storage:', storageError);
          // Continuar con la eliminación del registro
        }
      }

      // Eliminar el registro de la base de datos
      console.log(`🗑️ Intentando eliminar máquina con ID: ${machine.id}, Serie: ${machine.serie}`);
      
      const { data, error } = await supabase
        .from('machines')
        .delete()
        .eq('id', machine.id)
        .select();

      console.log('📋 Resultado de eliminación:', { data, error });

      if (error) {
        const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
        console.error('❌ Error detallado al eliminar:', {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint
        });
        
        // Mensajes de error más específicos
        const errorCode = supabaseError.code;
        const errorMessage = supabaseError.message || 'Error desconocido';
        
        if (errorCode === '42501') {
          throw new Error('No tienes permisos para eliminar máquinas. Verifica que tengas rol de administrador y que la política RLS esté configurada.');
        } else if (errorCode === '23503') {
          throw new Error('No se puede eliminar esta máquina porque tiene solicitudes de transporte asociadas. Elimina primero las solicitudes relacionadas.');
        } else {
          throw new Error(`Error al eliminar: ${errorMessage}`);
        }
      }

      // Si no hay error, asumimos que se eliminó correctamente
      // Nota: Supabase puede no devolver data en DELETE incluso si fue exitoso
      // Esto es normal, verificamos por el error en su lugar
      console.log(`✅ Registro eliminado exitosamente (data: ${data?.length || 0} registros)`);

      console.log('✅ Máquina eliminada de la BD, actualizando frontend...');
      
      // Actualizar el cache directamente eliminando el item (más rápido que refetch)
      queryClient.setQueryData(['machines'], (oldData: Machine[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(m => m.id !== machine.id);
      });
      
      // Invalidar cache y forzar refetch inmediato (múltiples métodos para asegurar actualización)
      invalidateMachines();
      
      // Invalidar y refrescar usando queryClient directamente (más agresivo)
      await queryClient.invalidateQueries({ queryKey: ['machines'] });
      
      // Forzar refetch inmediato de todas las queries activas
      await queryClient.refetchQueries({ 
        queryKey: ['machines'], 
        type: 'active',
        exact: true
      });
      
      // También llamar al refetch del hook
      await refetchMachines();
      
      console.log('✅ Frontend actualizado');
      
      alert('✅ Máquina eliminada exitosamente');
    } catch (error: unknown) {
      console.error('Error eliminando máquina:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al eliminar la máquina: ${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    { key: 'serie', label: 'Serie', sortable: true },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'marca', label: 'Marca', sortable: true },
    { key: 'modelo', label: 'Línea/Modelo' },
    { key: 'clase', label: 'Clase' },
    { key: 'numero_identificacion', label: 'Nro. Identificación' },
    { key: 'numero_chasis', label: 'Nro. Chasis' },
    { key: 'numero_motor', label: 'Nro. Motor' },
    { key: 'cilindraje', label: 'Cilindraje', render: (item: Machine) => item.cilindraje ? `${item.cilindraje} cc` : '-' },
    { key: 'rodaje', label: 'Rodaje' },
    { key: 'estado_vehiculo', label: 'Estado' },
    { key: 'numero_serie_gps', label: 'Nro. Serie GPS' },
    { key: 'numero_imei_gps', label: 'Nro. IMEI GPS' },
    { key: 'empresa_gps', label: 'Empresa GPS' },
    {
      key: 'dimensions',
      label: 'Dimensiones (L×A×H)',
      render: (item: Machine) => 
        item.largo && item.ancho && item.alto 
          ? `${item.largo}m × ${item.ancho}m × ${item.alto}m`
          : '-',
    },
    {
      key: 'peso',
      label: 'Peso',
      render: (item: Machine) => item.peso ? `${item.peso} kg` : '-',
    },
    {
      key: 'runt_image',
      label: 'RUNT',
      render: (item: Machine) => 
        item.runt_image_url ? (
          <div className="flex items-center">
            <img 
              src={item.runt_image_url} 
              alt={`RUNT ${item.serie}`}
              className="w-8 h-8 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.open(item.runt_image_url!, '_blank')}
              title="Click para ver imagen completa"
            />
          </div>
        ) : (
          <span className="text-gray-400 text-xs flex items-center">
            <X className="h-3 w-3" />
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (item: Machine) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEdit(item)}
            className="h-7 px-2 text-xs"
            title="Editar máquina"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const input = imageUploadRefs.current[item.id];
              if (input) {
                input.click();
              }
            }}
            disabled={uploadingImageForId === item.id}
            className="h-7 px-2 text-xs"
            title="Subir imagen del RUNT"
          >
            {uploadingImageForId === item.id ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </Button>
          <input
            ref={(el) => { imageUploadRefs.current[item.id] = el; }}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, item)}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleDelete(item)}
            disabled={deletingId === item.id}
            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Eliminar máquina"
          >
            {deletingId === item.id ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Máquinas</h1>
            <p className="mt-1 text-sm text-gray-600">
              Administra la base de datos de máquinas para solicitudes de transporte
            </p>
          </div>
        </div>

        {/* Formulario para subir RUNT */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-white" style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }}>
            <h2 className="text-lg font-semibold flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Cargar Imagen del RUNT
            </h2>
          </CardHeader>
          <CardBody className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen del RUNT
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Subir Imagen
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Tomar Foto
                  </Button>
                </div>
              </div>

              {runtPreview && (
                <div className="relative border-2 rounded-lg p-2" style={{ borderColor: '#cf1b22', backgroundColor: '#FFFFFF' }}>
                  <img
                    src={runtPreview}
                    alt="RUNT Preview"
                    className="w-full max-h-64 object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setRuntImage(null);
                      setRuntPreview('');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {ocrProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Loader className="h-5 w-5 mr-2 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        Procesando imagen con OCR... {progress}%
                      </p>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={processRUNTImage}
                disabled={!runtImage || isProcessing || ocrProcessing}
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: '#cf1b22' }}
                size="sm"
              >
                {isProcessing || ocrProcessing ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Extraer Datos con OCR
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Tabla de máquinas */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Máquinas Registradas ({machines.length})
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {editingId && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input
                    label="Serie"
                    value={editData.serie || ''}
                    onChange={(e) => setEditData({ ...editData, serie: e.target.value })}
                  />
                  <Input
                    label="Descripción"
                    value={editData.descripcion || ''}
                    onChange={(e) => setEditData({ ...editData, descripcion: e.target.value })}
                  />
                  <Input
                    label="Marca"
                    value={editData.marca || ''}
                    onChange={(e) => setEditData({ ...editData, marca: e.target.value })}
                  />
                  <Input
                    label="Línea/Modelo"
                    value={editData.modelo || ''}
                    onChange={(e) => setEditData({ ...editData, modelo: e.target.value })}
                  />
                  <Input
                    label="Largo (m)"
                    type="number"
                    step="0.01"
                    value={editData.largo?.toString() || ''}
                    onChange={(e) => setEditData({ ...editData, largo: parseFloat(e.target.value) || null })}
                  />
                  <Input
                    label="Ancho (m)"
                    type="number"
                    step="0.01"
                    value={editData.ancho?.toString() || ''}
                    onChange={(e) => setEditData({ ...editData, ancho: parseFloat(e.target.value) || null })}
                  />
                  <Input
                    label="Alto (m)"
                    type="number"
                    step="0.01"
                    value={editData.alto?.toString() || ''}
                    onChange={(e) => setEditData({ ...editData, alto: parseFloat(e.target.value) || null })}
                  />
                  <Input
                    label="Peso (kg)"
                    type="number"
                    step="0.01"
                    value={editData.peso?.toString() || ''}
                    onChange={(e) => setEditData({ ...editData, peso: parseFloat(e.target.value) || null })}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <Input
                    label="Nro. Identificación"
                    value={editData.numero_identificacion || ''}
                    onChange={(e) => setEditData({ ...editData, numero_identificacion: e.target.value })}
                  />
                  <Input
                    label="Clase"
                    value={editData.clase || ''}
                    onChange={(e) => setEditData({ ...editData, clase: e.target.value })}
                  />
                  <Input
                    label="Nro. Chasis"
                    value={editData.numero_chasis || ''}
                    onChange={(e) => setEditData({ ...editData, numero_chasis: e.target.value })}
                  />
                  <Input
                    label="Nro. Motor"
                    value={editData.numero_motor || ''}
                    onChange={(e) => setEditData({ ...editData, numero_motor: e.target.value })}
                  />
                  <Input
                    label="Cilindraje (cc)"
                    type="number"
                    value={editData.cilindraje?.toString() || ''}
                    onChange={(e) => setEditData({ ...editData, cilindraje: parseInt(e.target.value) || null })}
                  />
                  <Input
                    label="Rodaje"
                    value={editData.rodaje || ''}
                    onChange={(e) => setEditData({ ...editData, rodaje: e.target.value })}
                  />
                  <Input
                    label="Estado Vehículo"
                    value={editData.estado_vehiculo || ''}
                    onChange={(e) => setEditData({ ...editData, estado_vehiculo: e.target.value })}
                  />
                  <Input
                    label="Nro. Serie GPS"
                    value={editData.numero_serie_gps || ''}
                    onChange={(e) => setEditData({ ...editData, numero_serie_gps: e.target.value })}
                  />
                  <Input
                    label="Nro. IMEI GPS"
                    value={editData.numero_imei_gps || ''}
                    onChange={(e) => setEditData({ ...editData, numero_imei_gps: e.target.value })}
                  />
                  <Input
                    label="Subpartida Arancelaria"
                    value={editData.subpartida_arancelaria || ''}
                    onChange={(e) => setEditData({ ...editData, subpartida_arancelaria: e.target.value })}
                  />
                  <Input
                    label="Empresa GPS"
                    value={editData.empresa_gps || ''}
                    onChange={(e) => setEditData({ ...editData, empresa_gps: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setEditData({});
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="text-white hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                    onClick={handleSaveEdit}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Guardar
                  </Button>
                </div>
              </div>
            )}
            <DataTable
              data={machines}
              columns={columns}
              emptyMessage="No hay máquinas registradas"
              isLoading={isLoading}
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};

