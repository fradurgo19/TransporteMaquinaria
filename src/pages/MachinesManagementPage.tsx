import React, { useState, useRef } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { DataTable } from '../organisms/DataTable';
import { Upload, Camera, Wand2, Loader, X, Save, Edit2 } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { useRUNTOCR } from '../hooks/useRUNTOCR';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';

interface Machine {
  id: string;
  serie: string;
  descripcion: string;
  marca: string;
  modelo: string;
  ancho: number;
  alto: number;
  largo: number;
  peso: number;
  created_at: string;
}

export const MachinesManagementPage: React.FC = () => {
  useProtectedRoute(['admin', 'admin_logistics']);
  const { user } = useAuth();
  
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [runtImage, setRuntImage] = useState<File | null>(null);
  const [runtPreview, setRuntPreview] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Machine>>({});
  
  const { extractDataFromRUNT, isProcessing: ocrProcessing, progress } = useRUNTOCR();
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    setIsLoading(true);
    try {
      const result = await executeSupabaseQuery(() =>
        supabase
          .from('machines')
          .select('*')
          .order('serie', { ascending: true })
      );

      if (result.data) {
        setMachines(result.data as Machine[]);
      }
    } catch (error) {
      console.error('Error cargando máquinas:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        `Peso: ${ocrResult.peso || 'No encontrado'} kg\n\n` +
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

      // Verificar si la serie ya existe
      const existing = machines.find(m => m.serie.toUpperCase() === ocrResult.serie.toUpperCase());
      if (existing) {
        const update = window.confirm(
          `La serie ${ocrResult.serie} ya existe. ¿Deseas actualizar el registro?`
        );
        
        if (update) {
          // Actualizar registro existente
          const { error } = await executeSupabaseQuery(() =>
            supabase
              .from('machines')
              .update({
                descripcion: ocrResult.descripcion || existing.descripcion,
                marca: ocrResult.marca || existing.marca,
                modelo: ocrResult.linea || ocrResult.modelo || existing.modelo, // Usar línea como modelo
                ancho: ocrResult.ancho ? parseFloat(ocrResult.ancho) : existing.ancho,
                alto: ocrResult.alto ? parseFloat(ocrResult.alto) : existing.alto,
                largo: ocrResult.largo ? parseFloat(ocrResult.largo) : existing.largo,
                peso: ocrResult.peso ? parseFloat(ocrResult.peso) : existing.peso,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          );

          if (error) throw error;
          alert('✅ Máquina actualizada exitosamente');
        }
      } else {
        // Crear nuevo registro
        const { error } = await executeSupabaseQuery(() =>
          supabase
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
              created_by: user?.id,
            }])
        );

        if (error) throw error;
        alert('✅ Máquina registrada exitosamente');
      }

      // Limpiar
      setRuntImage(null);
      setRuntPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      loadMachines();
    } catch (error: any) {
      console.error('Error procesando imagen:', error);
      alert(`Error: ${error.message}`);
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
      const { error } = await executeSupabaseQuery(() =>
        supabase
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
          })
          .eq('id', editingId)
      );

      if (error) throw error;
      
      alert('✅ Máquina actualizada exitosamente');
      setEditingId(null);
      setEditData({});
      loadMachines();
    } catch (error: any) {
      console.error('Error actualizando:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const columns = [
    { key: 'serie', label: 'Serie', sortable: true },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'marca', label: 'Marca', sortable: true },
    { key: 'modelo', label: 'Línea/Modelo' },
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
      key: 'actions',
      label: 'Acciones',
      render: (item: Machine) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleEdit(item)}
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Editar
        </Button>
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
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
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
                <div className="relative border-2 border-blue-200 rounded-lg p-2 bg-gray-50">
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
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                    className="bg-blue-600 hover:bg-blue-700 text-white"
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

