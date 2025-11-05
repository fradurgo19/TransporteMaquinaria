import React, { useState, useEffect } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { Plus, Upload, Download, Eye, X, AlertCircle, Edit, Save } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { format, differenceInDays, parseISO } from 'date-fns';

interface Equipment {
  id: string;
  driver_name: string;
  site_location: string;
  brand: string;
  license_plate: string;
  serial_number: string;
  technical_inspection_expiration: string;
  soat_expiration: string;
  insurance_policy_expiration: string;
  driver_license_expiration: string;
  permit_status: string;
  status: string;
}

interface DocumentUpload {
  equipmentId: string;
  documentType: 'tecno' | 'soat' | 'poliza' | 'licencia';
  file: File | null;
}

export const EquipmentPage: React.FC = () => {
  const { user } = useProtectedRoute(['admin']); // Solo administradores
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState<DocumentUpload>({
    equipmentId: '',
    documentType: 'tecno',
    file: null,
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Equipment>>({});

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setIsLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/equipment?select=*&order=license_plate.asc`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
      }
    } catch (error) {
      console.error('Error cargando equipos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openUploadModal = (equipmentId: string, docType: 'tecno' | 'soat' | 'poliza' | 'licencia') => {
    setUploadData({
      equipmentId,
      documentType: docType,
      file: null,
    });
    setPreviewUrl('');
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadData({ ...uploadData, file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadData.file) {
      alert('Selecciona un archivo');
      return;
    }

    console.log('📤 Subiendo documento:', uploadData);
    alert('Funcionalidad de subida próximamente');
    setShowUploadModal(false);
  };

  const startEdit = (equip: Equipment) => {
    setEditingId(equip.id);
    setEditData({
      driver_name: equip.driver_name,
      site_location: equip.site_location,
      technical_inspection_expiration: equip.technical_inspection_expiration,
      soat_expiration: equip.soat_expiration,
      insurance_policy_expiration: equip.insurance_policy_expiration,
      driver_license_expiration: equip.driver_license_expiration,
      permit_status: equip.permit_status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (equipId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/equipment?id=eq.${equipId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editData),
        }
      );

      if (response.ok) {
        console.log('✅ Equipo actualizado');
        setEditingId(null);
        setEditData({});
        await fetchEquipment();
      } else {
        alert('Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar');
    }
  };

  const getExpirationBadge = (expirationDate: string) => {
    if (!expirationDate) return null;
    
    const days = differenceInDays(parseISO(expirationDate), new Date());
    
    if (days < 0) {
      return <Badge variant="error">VENCIDO</Badge>;
    } else if (days <= 30) {
      return <Badge variant="warning">{days}d</Badge>;
    }
    return <Badge variant="success">{days}d</Badge>;
  };

  return (
    <MainLayout>
      {/* Modal de subida de documentos */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Subir Documento
                </h2>
                <button onClick={() => setShowUploadModal(false)}>
                  <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                </button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Documento
                  </label>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {uploadData.documentType === 'tecno' && 'Revisión Técnica'}
                    {uploadData.documentType === 'soat' && 'SOAT'}
                    {uploadData.documentType === 'poliza' && 'Póliza de Seguro'}
                    {uploadData.documentType === 'licencia' && 'Licencia de Conducción'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Archivo
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {previewUrl && (
                  <div className="border rounded-lg p-2">
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain" />
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={!uploadData.file}>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Equipos</h1>
            <p className="mt-2 text-gray-600">
              Control de vehículos y documentación
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Lista de Equipos</h2>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Cargando equipos...</p>
              </div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay equipos registrados</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conductor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sede</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serie</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tecno</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">SOAT</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Póliza</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Licencia</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Permiso</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {equipment.map((equip) => {
                    const isEditing = editingId === equip.id;
                    
                    return (
                    <tr key={equip.id} className="hover:bg-gray-50">
                      {/* Conductor */}
                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <Input
                            value={editData.driver_name || ''}
                            onChange={(e) => setEditData({ ...editData, driver_name: e.target.value })}
                            className="w-full"
                          />
                        ) : (
                          <span className="text-gray-900">{equip.driver_name}</span>
                        )}
                      </td>

                      {/* Sede */}
                      <td className="px-4 py-3 text-sm">
                        {isEditing ? (
                          <Input
                            value={editData.site_location || ''}
                            onChange={(e) => setEditData({ ...editData, site_location: e.target.value })}
                            className="w-full"
                          />
                        ) : (
                          <span className="text-gray-900">{equip.site_location}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-900">{equip.brand}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{equip.license_plate}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{equip.serial_number}</td>
                      
                      {/* TECNO */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editData.technical_inspection_expiration || ''}
                              onChange={(e) => setEditData({ ...editData, technical_inspection_expiration: e.target.value })}
                              className="w-32 text-xs"
                            />
                          ) : (
                            <>
                              <span className="text-xs text-gray-600">
                                {format(parseISO(equip.technical_inspection_expiration), 'dd/MM/yy')}
                              </span>
                              {getExpirationBadge(equip.technical_inspection_expiration)}
                            </>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'tecno')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* SOAT */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editData.soat_expiration || ''}
                              onChange={(e) => setEditData({ ...editData, soat_expiration: e.target.value })}
                              className="w-32 text-xs"
                            />
                          ) : (
                            <>
                              <span className="text-xs text-gray-600">
                                {format(parseISO(equip.soat_expiration), 'dd/MM/yy')}
                              </span>
                              {getExpirationBadge(equip.soat_expiration)}
                            </>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'soat')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* PÓLIZA */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editData.insurance_policy_expiration || ''}
                              onChange={(e) => setEditData({ ...editData, insurance_policy_expiration: e.target.value })}
                              className="w-32 text-xs"
                            />
                          ) : (
                            <>
                              <span className="text-xs text-gray-600">
                                {format(parseISO(equip.insurance_policy_expiration), 'dd/MM/yy')}
                              </span>
                              {getExpirationBadge(equip.insurance_policy_expiration)}
                            </>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'poliza')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* LICENCIA */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editData.driver_license_expiration || ''}
                              onChange={(e) => setEditData({ ...editData, driver_license_expiration: e.target.value })}
                              className="w-32 text-xs"
                            />
                          ) : (
                            <>
                              <span className="text-xs text-gray-600">
                                {format(parseISO(equip.driver_license_expiration), 'dd/MM/yy')}
                              </span>
                              {getExpirationBadge(equip.driver_license_expiration)}
                            </>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'licencia')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* PERMISO */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input
                            value={editData.permit_status || ''}
                            onChange={(e) => setEditData({ ...editData, permit_status: e.target.value })}
                            className="w-24 text-xs"
                          />
                        ) : (
                          <span className="text-xs text-gray-600">{equip.permit_status}</span>
                        )}
                      </td>

                      {/* ACCIONES */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(equip.id)}
                              title="Guardar"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={cancelEdit}
                              title="Cancelar"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(equip)}
                            title="Editar"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                  )}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
