import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { Badge } from '../atoms/Badge';
import { Plus, Upload, Download, Eye, X, AlertCircle, Edit, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { format, differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../services/supabase';
import { useEquipment, useEquipmentMutation } from '../hooks/useEquipment';
import { uploadFile, compressImage } from '../services/uploadService';

interface Equipment {
  id: string;
  driver_name: string;
  site_location: string;
  brand: string;
  license_plate: string;
  serial_number: string;
  vehicle_type?: string;
  technical_inspection_expiration: string;
  soat_expiration: string;
  insurance_policy_expiration: string;
  driver_license_expiration: string;
  permit_status: string;
  status: string;
  notes?: string;
  technical_inspection_url?: string;
  soat_url?: string;
  insurance_policy_url?: string;
  driver_license_url?: string;
}

interface NewEquipmentForm {
  driver_name: string;
  site_location: string;
  brand: string;
  license_plate: string;
  serial_number: string;
  vehicle_type: 'tractor' | 'trailer';
  technical_inspection_expiration: string;
  soat_expiration: string;
  insurance_policy_expiration: string;
  driver_license_expiration: string;
  permit_status: string;
  status: 'active' | 'maintenance' | 'inactive' | 'retired';
  notes: string;
}

interface DocumentUpload {
  equipmentId: string;
  documentType: 'tecno' | 'soat' | 'poliza' | 'licencia';
  file: File | null;
}

export const EquipmentPage: React.FC = () => {
  const { user } = useProtectedRoute(['admin', 'admin_logistics']); // Administradores de ambos departamentos
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState<DocumentUpload>({
    equipmentId: '',
    documentType: 'tecno',
    file: null,
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Equipment>>({});
  const [newEquipment, setNewEquipment] = useState<NewEquipmentForm>({
    driver_name: '',
    site_location: '',
    brand: '',
    license_plate: '',
    serial_number: '',
    vehicle_type: 'tractor',
    technical_inspection_expiration: '',
    soat_expiration: '',
    insurance_policy_expiration: '',
    driver_license_expiration: '',
    permit_status: '',
    status: 'active',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewEquipmentForm, string>>>({});

  // Usar hook optimizado con paginación y filtros
  const { 
    data: equipmentData, 
    isLoading, 
    error: equipmentError 
  } = useEquipment({
    page: currentPage,
    status: statusFilter || undefined,
    search: searchTerm || undefined,
    useFullFields: false, // Solo campos necesarios para la tabla
  });

  const { createEquipment, updateEquipment } = useEquipmentMutation();

  const equipment = equipmentData?.data || [];
  const totalPages = equipmentData?.totalPages || 1;

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

    setIsUploading(true);
    
    try {
    console.log('📤 Subiendo documento:', uploadData);
      
      const equip = equipment.find(e => e.id === uploadData.equipmentId);
      if (!equip) {
        alert('Equipo no encontrado');
        return;
      }

      // Comprimir si es imagen
      let fileToUpload = uploadData.file;
      if (uploadData.file.type.startsWith('image/')) {
        fileToUpload = await compressImage(uploadData.file);
      }

      // Subir a Storage
      const upload = await uploadFile(
        fileToUpload,
        'equipment-documents' as any, // Nuevo bucket
        `${equip.license_plate}/${uploadData.documentType}`
      );

      if (!upload) {
        alert('Error al subir el archivo');
        return;
      }

      // Actualizar equipment con URL del documento
      const columnMap: Record<string, string> = {
        tecno: 'technical_inspection_url',
        soat: 'soat_url',
        poliza: 'insurance_policy_url',
        licencia: 'driver_license_url',
      };

      const column = columnMap[uploadData.documentType];
      
      const { error } = await supabase
        .from('equipment')
        .update({ [column]: upload.url })
        .eq('id', uploadData.equipmentId);

      if (error) {
        console.error('Error actualizando equipment:', error);
        alert(`Error: ${error.message}`);
        return;
      }

      console.log('✅ Documento subido y guardado');
      alert('✅ Documento subido exitosamente');
    setShowUploadModal(false);
      setUploadData({ equipmentId: '', documentType: 'tecno', file: null });
      setPreviewUrl('');
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
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
      await updateEquipment.mutateAsync({ id: equipId, updates: editData });
      console.log('✅ Equipo actualizado');
      setEditingId(null);
      setEditData({});
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error al actualizar: ${error.message || 'Error desconocido'}`);
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewEquipmentForm, string>> = {};

    if (!newEquipment.driver_name.trim()) {
      errors.driver_name = 'El nombre del conductor es requerido';
    }

    if (!newEquipment.site_location.trim()) {
      errors.site_location = 'La sede es requerida';
    }

    if (!newEquipment.brand.trim()) {
      errors.brand = 'La marca es requerida';
    }

    if (!newEquipment.license_plate.trim()) {
      errors.license_plate = 'La placa es requerida';
    }

    if (!newEquipment.serial_number.trim()) {
      errors.serial_number = 'El número de serie es requerido';
    }

    if (!newEquipment.technical_inspection_expiration) {
      errors.technical_inspection_expiration = 'La fecha de vencimiento de revisión técnica es requerida';
    }

    if (!newEquipment.soat_expiration) {
      errors.soat_expiration = 'La fecha de vencimiento del SOAT es requerida';
    }

    if (!newEquipment.insurance_policy_expiration) {
      errors.insurance_policy_expiration = 'La fecha de vencimiento de la póliza es requerida';
    }

    if (!newEquipment.driver_license_expiration) {
      errors.driver_license_expiration = 'La fecha de vencimiento de la licencia es requerida';
    }

    if (!newEquipment.permit_status.trim()) {
      errors.permit_status = 'El estado del permiso es requerido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateEquipment = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await createEquipment.mutateAsync(newEquipment);
      console.log('✅ Equipo creado exitosamente');
        // Resetear formulario
        setNewEquipment({
          driver_name: '',
          site_location: '',
          brand: '',
          license_plate: '',
          serial_number: '',
          vehicle_type: 'tractor',
          technical_inspection_expiration: '',
          soat_expiration: '',
          insurance_policy_expiration: '',
          driver_license_expiration: '',
          permit_status: '',
          status: 'active',
          notes: '',
        });
        setFormErrors({});
        setShowAddModal(false);
      // Volver a la primera página para ver el nuevo equipo
      setCurrentPage(1);
    } catch (error: any) {
      console.error('Error:', error);
      
      // Manejar errores específicos
      if (error.code === '23505') {
        if (error.message?.includes('license_plate')) {
          alert('Error: Ya existe un equipo con esta placa');
        } else if (error.message?.includes('serial_number')) {
          alert('Error: Ya existe un equipo con este número de serie');
        } else {
          alert('Error: Ya existe un equipo con estos datos');
        }
      } else {
        alert(`Error al crear equipo: ${error.message || 'Error inesperado'}`);
      }
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setNewEquipment({
      driver_name: '',
      site_location: '',
      brand: '',
      license_plate: '',
      serial_number: '',
      vehicle_type: 'tractor',
      technical_inspection_expiration: '',
      soat_expiration: '',
      insurance_policy_expiration: '',
      driver_license_expiration: '',
      permit_status: '',
      status: 'active',
      notes: '',
    });
    setFormErrors({});
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
      {/* Modal de agregar equipo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Agregar Nuevo Equipo
                </h2>
                <button onClick={handleCloseAddModal}>
                  <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                </button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                {/* Información Básica */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nombre del Conductor *"
                      value={newEquipment.driver_name}
                      onChange={(e) => setNewEquipment({ ...newEquipment, driver_name: e.target.value })}
                      error={formErrors.driver_name}
                      placeholder="Ej: Juan Pérez"
                    />
                    <Input
                      label="Sede *"
                      value={newEquipment.site_location}
                      onChange={(e) => setNewEquipment({ ...newEquipment, site_location: e.target.value })}
                      error={formErrors.site_location}
                      placeholder="Ej: Bogotá"
                    />
                    <Input
                      label="Marca *"
                      value={newEquipment.brand}
                      onChange={(e) => setNewEquipment({ ...newEquipment, brand: e.target.value })}
                      error={formErrors.brand}
                      placeholder="Ej: Volvo"
                    />
                    <Input
                      label="Placa *"
                      value={newEquipment.license_plate}
                      onChange={(e) => setNewEquipment({ ...newEquipment, license_plate: e.target.value.toUpperCase() })}
                      error={formErrors.license_plate}
                      placeholder="Ej: ABC123"
                    />
                    <Input
                      label="Número de Serie *"
                      value={newEquipment.serial_number}
                      onChange={(e) => setNewEquipment({ ...newEquipment, serial_number: e.target.value })}
                      error={formErrors.serial_number}
                      placeholder="Ej: SN123456"
                    />
                    <Select
                      label="Tipo de Vehículo *"
                      value={newEquipment.vehicle_type}
                      onChange={(e) => setNewEquipment({ ...newEquipment, vehicle_type: e.target.value as 'tractor' | 'trailer' })}
                      options={[
                        { value: 'tractor', label: 'Tractor' },
                        { value: 'trailer', label: 'Remolque' },
                      ]}
                    />
                    <Select
                      label="Estado *"
                      value={newEquipment.status}
                      onChange={(e) => setNewEquipment({ ...newEquipment, status: e.target.value as NewEquipmentForm['status'] })}
                      options={[
                        { value: 'active', label: 'Activo' },
                        { value: 'maintenance', label: 'En Mantenimiento' },
                        { value: 'inactive', label: 'Inactivo' },
                        { value: 'retired', label: 'Retirado' },
                      ]}
                    />
                    <Input
                      label="Estado del Permiso *"
                      value={newEquipment.permit_status}
                      onChange={(e) => setNewEquipment({ ...newEquipment, permit_status: e.target.value })}
                      error={formErrors.permit_status}
                      placeholder="Ej: Vigente"
                    />
                  </div>
                </div>

                {/* Fechas de Vencimiento */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fechas de Vencimiento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Revisión Técnica *"
                      type="date"
                      value={newEquipment.technical_inspection_expiration}
                      onChange={(e) => setNewEquipment({ ...newEquipment, technical_inspection_expiration: e.target.value })}
                      error={formErrors.technical_inspection_expiration}
                    />
                    <Input
                      label="SOAT *"
                      type="date"
                      value={newEquipment.soat_expiration}
                      onChange={(e) => setNewEquipment({ ...newEquipment, soat_expiration: e.target.value })}
                      error={formErrors.soat_expiration}
                    />
                    <Input
                      label="Póliza de Seguro *"
                      type="date"
                      value={newEquipment.insurance_policy_expiration}
                      onChange={(e) => setNewEquipment({ ...newEquipment, insurance_policy_expiration: e.target.value })}
                      error={formErrors.insurance_policy_expiration}
                    />
                    <Input
                      label="Licencia de Conducción *"
                      type="date"
                      value={newEquipment.driver_license_expiration}
                      onChange={(e) => setNewEquipment({ ...newEquipment, driver_license_expiration: e.target.value })}
                      error={formErrors.driver_license_expiration}
                    />
                  </div>
                </div>

                {/* Notas Adicionales */}
                <div>
                  <TextArea
                    label="Notas Adicionales"
                    value={newEquipment.notes}
                    onChange={(e) => setNewEquipment({ ...newEquipment, notes: e.target.value })}
                    placeholder="Información adicional sobre el equipo..."
                    rows={4}
                  />
                </div>

                {/* Botones de Acción */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button variant="secondary" onClick={handleCloseAddModal} disabled={createEquipment.isPending}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateEquipment} disabled={createEquipment.isPending}>
                    {createEquipment.isPending ? 'Creando...' : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Equipo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

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
                  <Button onClick={handleUpload} disabled={!uploadData.file || isUploading}>
                    {isUploading ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir
                      </>
                    )}
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
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Agregar Equipo
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Lista de Equipos</h2>
              
              {/* Búsqueda y Filtros */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Input
                  placeholder="Buscar por placa, conductor, marca..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Resetear a primera página al buscar
                  }}
                  className="flex-1 md:min-w-[250px]"
                />
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1); // Resetear a primera página al filtrar
                  }}
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'active', label: 'Activo' },
                    { value: 'maintenance', label: 'En Mantenimiento' },
                    { value: 'inactive', label: 'Inactivo' },
                    { value: 'retired', label: 'Retirado' },
                  ]}
                  className="w-full md:w-auto"
                />
              </div>
            </div>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Cargando equipos...</p>
              </div>
            ) : equipmentError ? (
              <div className="text-center py-8">
                <p className="text-red-500">Error al cargar equipos. Por favor, intenta de nuevo.</p>
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
                          <div className="flex gap-1">
                            {equip.technical_inspection_url && (
                              <a
                                href={equip.technical_inspection_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700"
                                title="Ver documento"
                              >
                                <Eye className="h-3 w-3" />
                              </a>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'tecno')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                          </div>
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
                          <div className="flex gap-1">
                            {equip.soat_url && (
                              <a
                                href={equip.soat_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700"
                                title="Ver documento"
                              >
                                <Eye className="h-3 w-3" />
                              </a>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'soat')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                          </div>
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
                          <div className="flex gap-1">
                            {equip.insurance_policy_url && (
                              <a
                                href={equip.insurance_policy_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700"
                                title="Ver documento"
                              >
                                <Eye className="h-3 w-3" />
                              </a>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'poliza')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                          </div>
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
                          <div className="flex gap-1">
                            {equip.driver_license_url && (
                              <a
                                href={equip.driver_license_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700"
                                title="Ver documento"
                              >
                                <Eye className="h-3 w-3" />
                              </a>
                          )}
                          <button
                            onClick={() => openUploadModal(equip.id, 'licencia')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Subir documento"
                          >
                            <Upload className="h-3 w-3" />
                          </button>
                          </div>
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
            
            {/* Controles de Paginación */}
            {equipmentData && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t border-gray-200 mt-4">
                <div className="text-sm text-gray-700">
                  Mostrando {((currentPage - 1) * (equipmentData.limit || 50)) + 1} - {Math.min(currentPage * (equipmentData.limit || 50), equipmentData.total)} de {equipmentData.total} equipos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLoading}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || isLoading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
