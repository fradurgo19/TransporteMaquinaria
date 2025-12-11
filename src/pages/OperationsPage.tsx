import React, { useState, useRef, useEffect } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, MapPin, Camera, Loader, Upload, Mail, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { format } from 'date-fns';
import { uploadFile, compressImage } from '../services/uploadService';
import { supabase } from '../services/supabase';
import { reverseGeocode } from '../services/geocodingService';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { sendOperationNotification } from '../services/operationNotifications';

// Tipos para las fotos con fecha/hora
interface PhotoWithMetadata {
  file: File;
  preview: string;
  timestamp: string;
  type: 'loading' | 'route_start' | 'delivery';
}

type OperationStep = 'loading' | 'route_start' | 'delivery' | null;

interface OperationProgress {
  loading: { completed: boolean; operationId: string | null };
  route_start: { completed: boolean; operationId: string | null };
  delivery: { completed: boolean; operationId: string | null };
}

export const OperationsPage: React.FC = () => {
  useProtectedRoute(['admin', 'user', 'guest']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<OperationStep>(null);
  const [progress, setProgress] = useState<OperationProgress>({
    loading: { completed: false, operationId: null },
    route_start: { completed: false, operationId: null },
    delivery: { completed: false, operationId: null },
  });
  
  // Estados por paso
  const [loadingData, setLoadingData] = useState({
    equipmentSerial: '',
    origin: '',
    notes: '',
    photo: null as PhotoWithMetadata | null,
  });
  
  const [routeStartData, setRouteStartData] = useState({
    destination: '',
    notes: '',
    photo: null as PhotoWithMetadata | null,
  });

  const [deliveryData, setDeliveryData] = useState({
    notes: '',
    photo: null as PhotoWithMetadata | null,
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [operations, setOperations] = useState<any[]>([]);
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';

  // Efecto para llenar automáticamente el origen cuando hay GPS (solo en paso loading)
  useEffect(() => {
    const fillOriginFromGPS = async () => {
      if (currentStep === 'loading' && latitude && longitude && !loadingData.origin && !isGeocoding) {
        setIsGeocoding(true);
        try {
          const result = await reverseGeocode(latitude, longitude);
          if (result.address && !result.error) {
            setLoadingData(prev => ({ ...prev, origin: result.address }));
            console.log('✅ Origen llenado automáticamente desde GPS:', result.address);
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo dirección desde GPS:', error);
        } finally {
          setIsGeocoding(false);
        }
      }
    };

    fillOriginFromGPS();
  }, [latitude, longitude, currentStep]);

  // Determinar el paso actual basado en el progreso
  useEffect(() => {
    if (!progress.loading.completed) {
      setCurrentStep('loading');
    } else if (!progress.route_start.completed) {
      setCurrentStep('route_start');
    } else if (!progress.delivery.completed) {
      setCurrentStep('delivery');
    } else {
      setCurrentStep(null);
    }
  }, [progress]);

  // Función para agregar fecha y hora a una imagen
  const addTimestampToImage = async (file: File, timestamp: string): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const date = new Date(timestamp);
          const dateStr = format(date, 'dd/MM/yyyy HH:mm:ss');
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, img.height - 40, img.width, 40);
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(dateStr, 10, img.height - 15);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const timestampedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(timestampedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.95);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Función para capturar/subir foto
  const handlePhotoCapture = (step: OperationStep) => {
    if (!photoInputRef.current) return;
    
    photoInputRef.current.setAttribute('capture', 'environment');
    photoInputRef.current.onchange = async (e: any) => {
      const files = Array.from(e.target?.files || []) as File[];
      if (files.length === 0) return;
      
      const file = files[0];
      const timestamp = new Date().toISOString();
      const timestampedFile = await addTimestampToImage(file, timestamp);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const photo: PhotoWithMetadata = {
          file: timestampedFile,
          preview: reader.result as string,
          timestamp,
          type: step!,
        };
        
        if (step === 'loading') {
          setLoadingData(prev => ({ ...prev, photo }));
        } else if (step === 'route_start') {
          setRouteStartData(prev => ({ ...prev, photo }));
        } else if (step === 'delivery') {
          setDeliveryData(prev => ({ ...prev, photo }));
        }
      };
      reader.readAsDataURL(timestampedFile);
      
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    };
    
    photoInputRef.current.click();
  };

  // Función para guardar cada paso
  const saveStep = async (step: OperationStep) => {
    if (!selectedEquipment || !user) {
      alert('Selecciona un equipo primero');
      return;
    }

    if (step === 'loading') {
      if (!loadingData.equipmentSerial || !loadingData.origin || !loadingData.photo) {
        alert('⚠️ Completa todos los campos requeridos: Serial, Origen y Foto');
        return;
      }
    } else if (step === 'route_start') {
      if (!routeStartData.destination || !routeStartData.photo) {
        alert('⚠️ Completa todos los campos requeridos: Destino y Foto');
        return;
      }
    } else if (step === 'delivery') {
      if (!deliveryData.photo) {
        alert('⚠️ Debes tomar una foto de entrega');
        return;
      }
    }

    setIsUploading(true);
    
    try {
      let photoUrl = '';
      
      // Subir foto
      if (step === 'loading' && loadingData.photo) {
        const compressed = await compressImage(loadingData.photo.file);
        const upload = await uploadFile(compressed, 'operation-photos', `${selectedEquipment.license_plate}/${format(new Date(), 'yyyy-MM-dd')}`);
        if (upload) photoUrl = upload.url;
      } else if (step === 'route_start' && routeStartData.photo) {
        const compressed = await compressImage(routeStartData.photo.file);
        const upload = await uploadFile(compressed, 'operation-photos', `${selectedEquipment.license_plate}/${format(new Date(), 'yyyy-MM-dd')}`);
        if (upload) photoUrl = upload.url;
      } else if (step === 'delivery' && deliveryData.photo) {
        const compressed = await compressImage(deliveryData.photo.file);
        const upload = await uploadFile(compressed, 'operation-photos', `${selectedEquipment.license_plate}/${format(new Date(), 'yyyy-MM-dd')}`);
        if (upload) photoUrl = upload.url;
      }

      // Guardar operación
      const operationData: any = {
        vehicle_plate: selectedEquipment.license_plate,
        operation_type: step,
        gps_latitude: latitude || 4.6097,
        gps_longitude: longitude || -74.0817,
        created_by: user.id,
      };

      if (step === 'loading') {
        operationData.equipment_serial = loadingData.equipmentSerial;
        operationData.origin = loadingData.origin;
        operationData.destination = null;
        operationData.notes = loadingData.notes || null;
      } else if (step === 'route_start') {
        // Obtener datos del loading anterior
        const loadingOp = await executeSupabaseQuery(() =>
          supabase
            .from('operations')
            .select('equipment_serial, origin')
            .eq('vehicle_plate', selectedEquipment.license_plate)
            .eq('operation_type', 'loading')
            .order('operation_timestamp', { ascending: false })
            .limit(1)
            .single()
        );
        
        if (loadingOp.data) {
          operationData.equipment_serial = loadingOp.data.equipment_serial;
          operationData.origin = loadingOp.data.origin;
        }
        operationData.destination = routeStartData.destination;
        operationData.notes = routeStartData.notes || null;
      } else if (step === 'delivery') {
        // Obtener datos del route_start anterior
        const routeStartOp = await executeSupabaseQuery(() =>
          supabase
            .from('operations')
            .select('equipment_serial, origin, destination')
            .eq('vehicle_plate', selectedEquipment.license_plate)
            .eq('operation_type', 'route_start')
            .order('operation_timestamp', { ascending: false })
            .limit(1)
            .single()
        );
        
        if (routeStartOp.data) {
          operationData.equipment_serial = routeStartOp.data.equipment_serial;
          operationData.origin = routeStartOp.data.origin;
          operationData.destination = routeStartOp.data.destination;
        }
        operationData.notes = deliveryData.notes || null;
      }

      const result = await executeSupabaseQuery(() =>
        supabase
          .from('operations')
          .insert([operationData])
          .select()
      );

      if (result.error) {
        throw result.error;
      }

      const operationId = result.data?.[0]?.id;

      // Guardar foto en operation_photos
      if (photoUrl && operationId) {
        await executeSupabaseQuery(() =>
          supabase
            .from('operation_photos')
            .insert({
              operation_id: operationId,
              photo_path: photoUrl,
              photo_description: `${step} - ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`,
            })
        );
      }

      // Actualizar progreso
      setProgress(prev => ({
        ...prev,
        [step]: { completed: true, operationId: operationId || null },
      }));

      // Enviar notificación automática para cada paso completado
      try {
        console.log(`📧 Enviando notificación automática para paso ${step}...`);
        await sendOperationNotification(operationId);
        console.log('✅ Notificación enviada automáticamente');
      } catch (error: any) {
        console.error('⚠️ Error enviando notificación automática:', error);
        // No bloquear el flujo si falla la notificación
      }

      // Limpiar datos del paso completado
      if (step === 'loading') {
        setLoadingData({ equipmentSerial: '', origin: '', notes: '', photo: null });
        alert('✅ Cargue completado - Notificación enviada');
      } else if (step === 'route_start') {
        setRouteStartData({ destination: '', notes: '', photo: null });
        alert('✅ Inicio de Recorrido completado - Notificación enviada');
      } else if (step === 'delivery') {
        setDeliveryData({ notes: '', photo: null });
        // Operación completa
        alert('✅ Entrega completada - Operación finalizada - Notificación enviada');
        setShowForm(false);
        setProgress({
          loading: { completed: false, operationId: null },
          route_start: { completed: false, operationId: null },
          delivery: { completed: false, operationId: null },
        });
        loadOperations();
      } else {
        alert(`✅ Paso ${step} completado - Notificación enviada`);
      }

      loadOperations();
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Cargar operaciones
  const loadOperations = async () => {
    setIsLoadingOperations(true);
    try {
      const result = await executeSupabaseQuery(() =>
        supabase
          .from('operations')
          .select('*')
          .order('operation_timestamp', { ascending: false })
          .limit(50)
      );

      if (result.data) {
        setOperations(result.data.map(op => ({
          id: op.id,
          vehiclePlate: op.vehicle_plate,
          operationType: op.operation_type,
          timestamp: op.operation_timestamp,
          cargo: op.cargo_description,
          origin: op.origin,
          destination: op.destination,
          equipmentSerial: op.equipment_serial,
          notificationSent: op.notification_sent,
          notificationSentAt: op.notification_sent_at,
        })));
      }
    } catch (error) {
      console.error('Error cargando operaciones:', error);
    } finally {
      setIsLoadingOperations(false);
    }
  };

  useEffect(() => {
    loadOperations();
  }, []);

  // Función para enviar notificaciones
  const handleSendNotification = async (operationId: string) => {
    if (!confirm('¿Enviar notificaciones por email a todas las personas involucradas?')) {
      return;
    }

    setSendingNotification(operationId);
    try {
      const result = await sendOperationNotification(operationId);
      alert(`✅ Notificaciones enviadas\n\nEnviadas: ${result.sent}\nFallidas: ${result.failed}`);
      loadOperations();
    } catch (error: any) {
      alert(`❌ Error al enviar notificaciones: ${error.message}`);
    } finally {
      setSendingNotification(null);
    }
  };

  const columns = [
    { key: 'vehiclePlate', label: 'Vehículo', sortable: true },
    {
      key: 'operationType',
      label: 'Tipo',
      render: (item: any) => {
        const types = {
          loading: 'Carga',
          route_start: 'Inicio Ruta',
          delivery: 'Entrega',
        };
        return types[item.operationType as keyof typeof types] || item.operationType;
      },
    },
    {
      key: 'timestamp',
      label: 'Fecha/Hora',
      render: (item: any) => format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm'),
    },
    { key: 'origin', label: 'Origen' },
    { key: 'destination', label: 'Destino' },
    {
      key: 'notificationSent',
      label: 'Notificación',
      render: (item: any) => {
        if (item.notificationSent) {
          return (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Enviada</span>
            </div>
          );
        }
        return <span className="text-xs text-gray-400">Pendiente</span>;
      },
    },
    ...(isAdmin ? [{
      key: 'actions',
      label: 'Acciones',
      render: (item: any) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleSendNotification(item.id)}
          disabled={sendingNotification === item.id || item.notificationSent}
        >
          {sendingNotification === item.id ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
        </Button>
      ),
    }] : []),
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Operaciones</h1>
            <p className="mt-2 text-gray-600">
              Registra carga, inicio de ruta y entregas de forma secuencial
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nueva Operación'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }} className="text-white">
              <h2 className="text-xl font-semibold">Nueva Operación</h2>
            </CardHeader>
            <CardBody>
              {/* Información del Equipo */}
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #50504f' }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: '#50504f' }}>Equipo Seleccionado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium" style={{ color: '#50504f' }}>Placa del Vehículo</label>
                    <p className="text-lg font-bold" style={{ color: '#cf1b22' }}>{selectedEquipment?.license_plate || 'No seleccionado'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: '#50504f' }}>Conductor</label>
                    <p className="text-lg font-bold" style={{ color: '#50504f' }}>{user?.full_name || user?.username || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Línea de Tiempo */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  {/* Paso 1: Cargue */}
                  <div className="flex-1">
                    <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                      currentStep === 'loading' 
                        ? 'border-blue-500 bg-blue-50' 
                        : progress.loading.completed 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        progress.loading.completed 
                          ? 'bg-green-500 text-white' 
                          : currentStep === 'loading' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-300 text-gray-600'
                      }`}>
                        {progress.loading.completed ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <span className="font-bold">1</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Cargue</h3>
                        <p className="text-xs text-gray-600">
                          {progress.loading.completed ? 'Completado' : currentStep === 'loading' ? 'En progreso...' : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="mx-2 text-gray-400" />

                  {/* Paso 2: Inicio de Recorrido */}
                  <div className="flex-1">
                    <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                      currentStep === 'route_start' 
                        ? 'border-blue-500 bg-blue-50' 
                        : progress.route_start.completed 
                          ? 'border-green-500 bg-green-50' 
                          : progress.loading.completed
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        progress.route_start.completed 
                          ? 'bg-green-500 text-white' 
                          : currentStep === 'route_start' 
                            ? 'bg-blue-500 text-white' 
                            : progress.loading.completed
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                      }`}>
                        {progress.route_start.completed ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <span className="font-bold">2</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Inicio de Recorrido</h3>
                        <p className="text-xs text-gray-600">
                          {progress.route_start.completed 
                            ? 'Completado' 
                            : currentStep === 'route_start' 
                              ? 'En progreso...' 
                              : progress.loading.completed
                                ? 'Listo para iniciar'
                                : 'Bloqueado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="mx-2 text-gray-400" />

                  {/* Paso 3: Entrega */}
                  <div className="flex-1">
                    <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                      currentStep === 'delivery' 
                        ? 'border-blue-500 bg-blue-50' 
                        : progress.delivery.completed 
                          ? 'border-green-500 bg-green-50' 
                          : progress.route_start.completed
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        progress.delivery.completed 
                          ? 'bg-green-500 text-white' 
                          : currentStep === 'delivery' 
                            ? 'bg-blue-500 text-white' 
                            : progress.route_start.completed
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                      }`}>
                        {progress.delivery.completed ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <span className="font-bold">3</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Entrega</h3>
                        <p className="text-xs text-gray-600">
                          {progress.delivery.completed 
                            ? 'Completado' 
                            : currentStep === 'delivery' 
                              ? 'En progreso...' 
                              : progress.route_start.completed
                                ? 'Listo para entregar'
                                : 'Bloqueado'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulario según el paso actual */}
              {currentStep === 'loading' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Paso 1: Cargue</h3>
                  
                  <Input
                    label="Serie del Equipo a Transportar *"
                    placeholder="Ej: CAT320D-2024-001"
                    value={loadingData.equipmentSerial}
                    onChange={(e) => setLoadingData(prev => ({ ...prev, equipmentSerial: e.target.value }))}
                    required
                  />

                  <div>
                    <Input
                      label="Origen *"
                      placeholder="Se llena automáticamente con GPS"
                      value={loadingData.origin}
                      onChange={(e) => setLoadingData(prev => ({ ...prev, origin: e.target.value }))}
                      disabled={isGeocoding}
                      required
                    />
                    {isGeocoding && (
                      <p className="text-xs text-blue-600 mt-1">🔄 Obteniendo dirección desde GPS...</p>
                    )}
                    {latitude && longitude && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ GPS: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Foto de Cargue *</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handlePhotoCapture('loading')}
                        className="flex-1"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        {loadingData.photo ? 'Cambiar Foto' : 'Tomar Foto'}
                      </Button>
                    </div>
                    {loadingData.photo && (
                      <div className="relative w-32 h-32">
                        <img 
                          src={loadingData.photo.preview} 
                          alt="Cargue"
                          className="w-full h-full object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => setLoadingData(prev => ({ ...prev, photo: null }))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        >
                          ×
                      </button>
                      </div>
                    )}
                  </div>

                  <TextArea
                    label="Novedades (Opcional)"
                    rows={2}
                    value={loadingData.notes}
                    onChange={(e) => setLoadingData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Reportar cualquier novedad..."
                  />

                  <Button
                    onClick={() => saveStep('loading')}
                    disabled={isUploading || !loadingData.equipmentSerial || !loadingData.origin || !loadingData.photo}
                    className="w-full text-white hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                  >
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cargue y Continuar'
                    )}
                  </Button>
                </div>
              )}

              {currentStep === 'route_start' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Paso 2: Inicio de Recorrido</h3>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-800">
                      <strong>Serial del Equipo:</strong> {loadingData.equipmentSerial || 'N/A'}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Origen:</strong> {loadingData.origin || 'N/A'}
                    </p>
                </div>

                  <Input
                    label="Destino *"
                    placeholder="Ej: Chía - Obra Los Arrayanes"
                    value={routeStartData.destination}
                    onChange={(e) => setRouteStartData(prev => ({ ...prev, destination: e.target.value }))}
                    required
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Foto de Inicio de Recorrido *</label>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handlePhotoCapture('route_start')}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {routeStartData.photo ? 'Cambiar Foto' : 'Tomar Foto'}
                    </Button>
                    {routeStartData.photo && (
                      <div className="relative w-32 h-32">
                        <img 
                          src={routeStartData.photo.preview} 
                          alt="Inicio de Recorrido"
                          className="w-full h-full object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => setRouteStartData(prev => ({ ...prev, photo: null }))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  <TextArea
                    label="Novedades (Opcional)"
                    rows={2}
                    value={routeStartData.notes}
                    onChange={(e) => setRouteStartData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Reportar cualquier novedad..."
                  />

                  <Button
                    onClick={() => saveStep('route_start')}
                    disabled={isUploading || !routeStartData.destination || !routeStartData.photo}
                    className="w-full text-white hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                  >
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Inicio de Recorrido y Continuar'
                    )}
                  </Button>
                </div>
              )}

              {currentStep === 'delivery' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Paso 3: Entrega</h3>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-800">
                      <strong>Serial del Equipo:</strong> {loadingData.equipmentSerial || 'N/A'}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Origen:</strong> {loadingData.origin || 'N/A'}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Destino:</strong> {routeStartData.destination || 'N/A'}
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-700">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      GPS: {latitude?.toFixed(6) || 'N/A'}, {longitude?.toFixed(6) || 'N/A'}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      📅 Fecha y hora se agregarán automáticamente a la foto
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Foto de Entrega *</label>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handlePhotoCapture('delivery')}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {deliveryData.photo ? 'Cambiar Foto' : 'Tomar Foto'}
                    </Button>
                    {deliveryData.photo && (
                      <div className="relative w-32 h-32">
                          <img 
                          src={deliveryData.photo.preview} 
                          alt="Entrega"
                          className="w-full h-full object-cover rounded border"
                          />
                          <button
                            type="button"
                          onClick={() => setDeliveryData(prev => ({ ...prev, photo: null }))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                    </div>
                  )}
                </div>

                  <TextArea
                    label="Novedades (Opcional)"
                    rows={2}
                    value={deliveryData.notes}
                    onChange={(e) => setDeliveryData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Reportar cualquier novedad..."
                  />

                  <Button
                    onClick={() => saveStep('delivery')}
                    disabled={isUploading || !deliveryData.photo}
                    className="w-full text-white hover:opacity-90"
                    style={{ backgroundColor: '#cf1b22' }}
                  >
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      'Finalizar Operación'
                    )}
                  </Button>
                </div>
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
              />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Operaciones</h2>
          </CardHeader>
          <CardBody className="p-0">
            {isLoadingOperations ? (
              <div className="text-center py-8">
                <Loader className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Cargando operaciones...</p>
              </div>
            ) : (
            <DataTable
                data={operations}
              columns={columns}
              emptyMessage="No hay operaciones registradas"
            />
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
