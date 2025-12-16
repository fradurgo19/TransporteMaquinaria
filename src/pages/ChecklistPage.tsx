import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, ClipboardCheck, CheckCircle, XCircle, MapPin, Camera, Upload, Loader } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format } from 'date-fns';
import { uploadFile, compressImage } from '../services/uploadService';
import { supabase } from '../services/supabase';
import { useDepartment } from '../hooks/useDepartment';

export const ChecklistPage: React.FC = () => {
  useProtectedRoute(['admin', 'user', 'logistics', 'admin_logistics']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { department } = useDepartment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const [showForm, setShowForm] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  
  // Estados del formulario con valores por defecto
  const [formData, setFormData] = useState({
    vehiclePlate: selectedEquipment?.license_plate || '',
    driverName: user?.full_name || user?.username || '',
    checkDate: format(new Date(), 'yyyy-MM-dd'),
    tireCondition: 'good',
    brakeCondition: 'good',
    lightsCondition: 'good',
    fluidLevels: 'good',
    engineCondition: 'good',
    vehicleConditionAssessment: '',
    passed: true,
  });

  // Cargar checklists desde Supabase filtrados por departamento
  const [checklists, setChecklists] = React.useState<any[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = React.useState(true);

  React.useEffect(() => {
    const loadChecklists = async () => {
      if (!department) return;
      
      setIsLoadingChecklists(true);
      try {
        const { data, error } = await supabase
          .from('pre_operational_checklists')
          .select('*')
          .eq('department', department)
          .order('check_date', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error cargando checklists:', error);
        } else {
          setChecklists(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoadingChecklists(false);
      }
    };

    loadChecklists();
  }, [department]);

  // Mapear checklists de Supabase al formato esperado
  const mappedChecklists = checklists.map((checklist) => ({
    id: checklist.id,
    vehiclePlate: checklist.vehicle_plate,
    driverName: checklist.driver_name,
    checkDate: checklist.check_date,
    passed: checklist.passed,
    assessment: checklist.vehicle_condition_assessment || '',
  }));

  const columns = [
    { key: 'vehiclePlate', label: 'Vehículo', sortable: true },
    { key: 'driverName', label: 'Conductor', sortable: true },
    {
      key: 'checkDate',
      label: 'Fecha',
      render: (item: any) => format(new Date(item.checkDate), 'dd/MM/yyyy'),
    },
    {
      key: 'passed',
      label: 'Estado',
      render: (item: any) =>
        item.passed ? (
          <span className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            Aprobado
          </span>
        ) : (
          <span className="flex items-center text-red-600">
            <XCircle className="h-4 w-4 mr-1" />
            Rechazado
          </span>
        ),
    },
    { key: 'assessment', label: 'Evaluación' },
  ];

  const conditionOptions = [
    { value: 'good', label: 'Bueno' },
    { value: 'fair', label: 'Regular' },
    { value: 'poor', label: 'Malo' },
    { value: 'critical', label: 'Crítico' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Checklist Pre-Operacional</h1>
            <p className="mt-1 text-sm text-gray-600">
              Inspección diaria del vehículo antes de operar
            </p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nueva Inspección'}
          </Button>
        </div>

        {showForm && (
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="bg-gradient-to-r text-white" style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }}>
              <h2 className="text-lg font-semibold flex items-center">
                <ClipboardCheck className="h-5 w-5 mr-2" />
                Inspección Pre-Operacional
              </h2>
            </CardHeader>
            <CardBody className="p-6">
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                
                if (!selectedEquipment || !user) {
                  alert('Selecciona un equipo primero');
                  return;
                }

                setIsUploading(true);
                
                try {
                  let photoUrl = '';
                  
                  // Subir foto si existe
                  if (photo) {
                    console.log('📤 Subiendo foto del checklist...');
                    const compressed = await compressImage(photo);
                    const upload = await uploadFile(
                      compressed,
                      'checklist-photos',
                      `${selectedEquipment.license_plate}/${format(new Date(), 'yyyy-MM-dd')}`
                    );
                    
                    if (upload) {
                      photoUrl = upload.url;
                    }
                  }

                  // Guardar checklist en Supabase
                  const { data, error } = await supabase
                    .from('pre_operational_checklists')
                    .insert([{
                      vehicle_plate: selectedEquipment.license_plate,
                      driver_name: user.full_name || user.username || '',
                      check_date: formData.checkDate,
                      tire_condition: formData.tireCondition,
                      brake_condition: formData.brakeCondition,
                      lights_condition: formData.lightsCondition,
                      fluid_levels: formData.fluidLevels,
                      engine_condition: formData.engineCondition,
                      vehicle_condition_assessment: formData.vehicleConditionAssessment,
                      passed: formData.passed,
                      photo_url: photoUrl,
                      location_latitude: latitude || 4.6097,
                      location_longitude: longitude || -74.0817,
                      created_by: user.id,
                      department: department, // Usar el departamento del usuario actual
                    }])
                    .select();

                  if (error) {
                    console.error('Error guardando:', error);
                    alert(`Error: ${error.message}`);
                    return;
                  }

                  console.log('✅ Checklist guardado:', data);
                  alert('✅ Checklist registrado exitosamente');
                  
                  // Recargar lista de checklists
                  const { data: updatedChecklists, error: reloadError } = await supabase
                    .from('pre_operational_checklists')
                    .select('*')
                    .eq('department', department)
                    .order('check_date', { ascending: false })
                    .limit(100);
                  
                  if (!reloadError && updatedChecklists) {
                    setChecklists(updatedChecklists);
                  }
                  
                  // Limpiar
                  setFormData({
                    vehiclePlate: selectedEquipment.license_plate,
                    driverName: user.full_name || user.username || '',
                    checkDate: format(new Date(), 'yyyy-MM-dd'),
                    tireCondition: 'good',
                    brakeCondition: 'good',
                    lightsCondition: 'good',
                    fluidLevels: 'good',
                    engineCondition: 'good',
                    vehicleConditionAssessment: '',
                    passed: true,
                  });
                  setPhoto(null);
                  setPhotoPreview('');
                  setShowForm(false);
                } catch (error: any) {
                  console.error('Error:', error);
                  alert(`Error: ${error.message}`);
                } finally {
                  setIsUploading(false);
                }
              }}>
                {/* Información del Equipo (Compacta) */}
                <div className="border-l-4 rounded-r-lg p-2 sm:p-3 mb-4" style={{ backgroundColor: '#FFFFFF', borderLeftColor: '#cf1b22', border: '1px solid #50504f' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#50504f' }}>Vehículo</label>
                      <p className="text-sm font-semibold" style={{ color: '#cf1b22' }}>{selectedEquipment?.license_plate}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#50504f' }}>Conductor</label>
                      <p className="text-sm font-semibold" style={{ color: '#50504f' }}>{user?.full_name || user?.username}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#50504f' }}>Fecha</label>
                      <p className="text-sm font-semibold" style={{ color: '#50504f' }}>{format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  {/* GPS compacto */}
                  <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid #50504f' }}>
                    <div className="flex items-center text-xs">
                      <MapPin className={`h-3 w-3 mr-1 ${latitude && longitude ? 'text-green-600' : 'text-yellow-600'}`} />
                      {geoLoading ? (
                        <span style={{ color: '#50504f' }}>Obteniendo ubicación...</span>
                      ) : latitude && longitude ? (
                        <span className="text-green-700">
                          GPS: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-yellow-700">{geoError || 'GPS no disponible'}</span>
                      )}
                    </div>
                    {!geoLoading && (
                      <button
                        type="button"
                        onClick={refreshLocation}
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: '#cf1b22' }}
                      >
                        Actualizar
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                  Condiciones del Vehículo
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Select
                    label="Neumáticos"
                    value={formData.tireCondition}
                    onChange={(e) => setFormData({ ...formData, tireCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Frenos"
                    value={formData.brakeCondition}
                    onChange={(e) => setFormData({ ...formData, brakeCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Luces"
                    value={formData.lightsCondition}
                    onChange={(e) => setFormData({ ...formData, lightsCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Fluidos"
                    value={formData.fluidLevels}
                    onChange={(e) => setFormData({ ...formData, fluidLevels: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                  <Select
                    label="Motor"
                    value={formData.engineCondition}
                    onChange={(e) => setFormData({ ...formData, engineCondition: e.target.value })}
                    options={conditionOptions}
                    required
                  />
                </div>

                <TextArea
                  label="Evaluación General"
                  rows={2}
                  value={formData.vehicleConditionAssessment}
                  onChange={(e) => setFormData({ ...formData, vehicleConditionAssessment: e.target.value })}
                  placeholder="Describe la condición general del vehículo..."
                  required
                />

                {/* Captura de Foto - Compacta */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Foto del Vehículo
                  </label>
                  
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhoto(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setPhotoPreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (photoInputRef.current) {
                          photoInputRef.current.setAttribute('capture', 'environment');
                          photoInputRef.current.click();
                        }
                      }}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Tomar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (photoInputRef.current) {
                          photoInputRef.current.removeAttribute('capture');
                          photoInputRef.current.click();
                        }
                      }}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Subir
                    </Button>
                  </div>

                  {photoPreview && (
                    <div className="relative border-2 rounded-lg p-2" style={{ borderColor: '#cf1b22', backgroundColor: '#FFFFFF' }}>
                      <img 
                        src={photoPreview} 
                        alt="Preview" 
                        className="w-full max-h-32 object-contain rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview('');
                        }}
                        className="absolute top-2 right-2 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:opacity-90"
                        style={{ backgroundColor: '#cf1b22' }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-l-4 rounded-r-lg p-3" style={{ backgroundColor: '#FFFFFF', borderLeftColor: '#cf1b22', border: '1px solid #50504f' }}>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.passed}
                      onChange={(e) => setFormData({ ...formData, passed: e.target.checked })}
                      className="w-4 h-4 rounded focus:ring-2 border-gray-300"
                      style={{ accentColor: '#cf1b22' }}
                    />
                    <span className="text-sm font-medium" style={{ color: '#50504f' }}>
                      Vehículo en condiciones de operar
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #50504f' }}>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowForm(false)} 
                    disabled={isUploading}
                    style={{ backgroundColor: '#50504f', color: '#FFFFFF' }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    className="text-white hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Inspección'
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Inspecciones</h2>
          </CardHeader>
          <CardBody className="p-0">
            {isLoadingChecklists ? (
              <div className="p-8 text-center">
                <Loader className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-gray-600">Cargando inspecciones...</p>
              </div>
            ) : (
              <DataTable
                data={mappedChecklists}
                columns={columns}
                emptyMessage="No hay inspecciones registradas"
              />
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
