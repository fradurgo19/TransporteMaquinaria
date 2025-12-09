import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { DataTable } from '../organisms/DataTable';
import { Plus, Fuel as FuelIcon, MapPin, Camera, Wand2, Loader, X, Edit2, Save } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useOCR } from '../hooks/useOCR';
import { useFuelLogs, useUpdateFuelLog } from '../hooks/useFuelLogs';
import { format } from 'date-fns';
import { uploadFile, compressImage } from '../services/uploadService';
import { supabase } from '../services/supabase';

export const FuelPage: React.FC = () => {
  useProtectedRoute(['admin', 'user']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const { extractDataFromReceipt, isProcessing, progress } = useOCR();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptPhotos, setReceiptPhotos] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [placaFilter, setPlacaFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: fuelLogsData, isLoading: isLoadingLogs } = useFuelLogs({
    page: currentPage,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    vehiclePlate: placaFilter || undefined,
  });

  const updateMutation = useUpdateFuelLog();
  
  // Estados del formulario con valores por defecto
  const [formData, setFormData] = useState({
    vehiclePlate: selectedEquipment?.license_plate || '',
    fuelDate: format(new Date(), 'yyyy-MM-dd'),
    gallons: '',
    cost: '',
    pricePerGallon: '',
    startingOdometer: '',
    endingOdometer: '',
    gasStationName: '',
  });

  // Cálculos automáticos
  const calculatedFields = useMemo(() => {
    const startingKm = parseFloat(formData.startingOdometer) || 0;
    const endingKm = parseFloat(formData.endingOdometer) || 0;
    const gallons = parseFloat(formData.gallons) || 0;
    const cost = parseFloat(formData.cost) || 0;
    
    const kmsRecorridos = endingKm > startingKm ? endingKm - startingKm : 0;
    const kmPerGallon = gallons > 0 ? kmsRecorridos / gallons : 0;
    
    // Si no hay precio por galón pero hay costo y galones, calcularlo
    let precioCombustible = parseFloat(formData.pricePerGallon) || 0;
    if (!precioCombustible && gallons > 0 && cost > 0) {
      precioCombustible = cost / gallons;
    }
    
    return {
      kmsRecorridos: kmsRecorridos.toFixed(2),
      kmPerGallon: kmPerGallon.toFixed(2),
      precioCombustible: precioCombustible.toFixed(2),
    };
  }, [formData.startingOdometer, formData.endingOdometer, formData.gallons, formData.cost, formData.pricePerGallon]);

  // Verificar si es admin
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';

  // Actualizar placa cuando cambia el equipo seleccionado
  useEffect(() => {
    if (selectedEquipment?.license_plate) {
      setFormData(prev => ({ ...prev, vehiclePlate: selectedEquipment.license_plate }));
    }
  }, [selectedEquipment]);

  const handleFileChange = async (file: File | null) => {
    if (file) {
      setReceipt(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceipt(null);
      setReceiptPreview('');
    }
  };

  const handleMultipleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    Array.from(files).forEach((file) => {
      newFiles.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === files.length) {
          setReceiptPreviews([...receiptPreviews, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    setReceiptPhotos([...receiptPhotos, ...newFiles]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = receiptPhotos.filter((_, i) => i !== index);
    const newPreviews = receiptPreviews.filter((_, i) => i !== index);
    setReceiptPhotos(newPhotos);
    setReceiptPreviews(newPreviews);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const processReceiptOCR = async () => {
    if (!receipt) {
      alert('Primero toma o sube una foto del recibo');
      return;
    }

    try {
      const result = await extractDataFromReceipt(receipt);
      
      console.log('📊 Datos extraídos:', result);

      // Auto-llenar formulario con datos extraídos del OCR
      setFormData(prev => {
        const gallons = result.gallons || prev.gallons;
        const cost = result.cost || prev.cost;
        let pricePerGallon = result.pricePerGallon || '';
        
        // Si no se extrajo precio por galón pero tenemos costo y galones, calcularlo
        if (!pricePerGallon && gallons && cost) {
          const gallonsNum = parseFloat(gallons.replace(',', '.'));
          const costNum = parseFloat(cost.replace(',', ''));
          if (gallonsNum > 0 && costNum > 0) {
            pricePerGallon = (costNum / gallonsNum).toFixed(2);
          }
        }
        
        return {
          ...prev,
          gallons: gallons,
          cost: cost,
          pricePerGallon: pricePerGallon,
          fuelDate: result.date ? formatDateFromOCR(result.date) : prev.fuelDate,
        };
      });

      alert('✅ Datos extraídos del recibo. Verifica y ajusta si es necesario.');
    } catch (error) {
      console.error('Error en OCR:', error);
      alert('Error al procesar la imagen. Intenta con mejor iluminación.');
    }
  };

  const formatDateFromOCR = (dateStr: string): string => {
    try {
      const parts = dateStr.split(/[-\/]/);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return format(new Date(), 'yyyy-MM-dd');
    } catch {
      return format(new Date(), 'yyyy-MM-dd');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEquipment || !user) {
      alert('Selecciona un equipo primero');
      return;
    }

    setIsUploading(true);
    
    try {
      const photoUrls: string[] = [];
      
      // Subir todas las fotos de tirillas
      const allPhotos = receipt ? [receipt, ...receiptPhotos] : receiptPhotos;
      for (const photo of allPhotos) {
        console.log('📤 Comprimiendo y subiendo foto...');
        const compressed = await compressImage(photo);
        const upload = await uploadFile(
          compressed, 
          'fuel-receipts', 
          `${selectedEquipment.license_plate}_${Date.now()}`
        );
        
        if (upload) {
          photoUrls.push(upload.url);
          console.log('✅ Foto subida:', upload.url);
        }
      }

      // Calcular valores
      const gallons = parseFloat(formData.gallons);
      const cost = parseFloat(formData.cost);
      const startingKm = parseInt(formData.startingOdometer);
      const endingKm = parseInt(formData.endingOdometer);
      const kmsRecorridos = endingKm > startingKm ? endingKm - startingKm : 0;
      const kmPerGallon = gallons > 0 ? kmsRecorridos / gallons : 0;
      const precioCombustible = parseFloat(formData.pricePerGallon) || (gallons > 0 ? cost / gallons : 0);

      // Guardar en Supabase
      const { data, error } = await supabase
        .from('fuel_logs')
        .insert([{
          vehicle_plate: selectedEquipment.license_plate,
          fuel_date: formData.fuelDate,
          gallons: gallons,
          cost: cost,
          starting_odometer: startingKm,
          ending_odometer: endingKm,
          distance_traveled: kmsRecorridos,
          fuel_efficiency: kmPerGallon,
          gas_station_name: formData.gasStationName,
          receipt_photo_path: photoUrls[0] || null, // Primera foto como principal
          receipt_photo_url: photoUrls[0] || null, // Compatibilidad
          gps_latitude: latitude || 4.6097,
          gps_longitude: longitude || -74.0817,
          created_by: user.id,
          department: 'transport',
        }])
        .select();

      if (error) {
        console.error('Error guardando:', error);
        alert(`Error: ${error.message}`);
        return;
      }

      console.log('✅ Combustible guardado:', data);
      alert('✅ Registro de combustible guardado exitosamente');
      
      // Limpiar formulario
      setFormData({
        vehiclePlate: selectedEquipment.license_plate,
        fuelDate: format(new Date(), 'yyyy-MM-dd'),
        gallons: '',
        cost: '',
        pricePerGallon: '',
        startingOdometer: '',
        endingOdometer: '',
        gasStationName: '',
      });
      setReceipt(null);
      setReceiptPreview('');
      setReceiptPhotos([]);
      setReceiptPreviews([]);
      setShowForm(false);
      
      // Recargar datos
      window.location.reload();
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error al guardar: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const startEdit = (record: any) => {
    if (!isAdmin) return;
    setEditingId(record.id);
    
    // Calcular valores para mostrar en edición
    const distanceTraveled = record.distance_traveled || (record.ending_odometer - record.starting_odometer);
    const pricePerGallon = record.gallons > 0 ? record.cost / record.gallons : 0;
    const fuelEfficiency = record.fuel_efficiency || (record.gallons > 0 ? distanceTraveled / record.gallons : 0);
    
    setEditData({
      vehiclePlate: record.vehicle_plate || '',
      fuelDate: record.fuel_date || record.date || '',
      gallons: record.gallons?.toString() || '',
      cost: record.cost?.toString() || '',
      pricePerGallon: pricePerGallon.toFixed(2),
      startingOdometer: record.starting_odometer?.toString() || record.startingOdometer?.toString() || '',
      endingOdometer: record.ending_odometer?.toString() || record.endingOdometer?.toString() || '',
      distanceTraveled: distanceTraveled.toFixed(2),
      fuelEfficiency: fuelEfficiency.toFixed(2),
      gasStationName: record.gas_station_name || record.gasStationName || '',
    });
  };

  // Calcular campos editables
  const calculateEditFields = () => {
    const startingKm = parseFloat(editData.startingOdometer) || 0;
    const endingKm = parseFloat(editData.endingOdometer) || 0;
    const gallons = parseFloat(editData.gallons) || 0;
    const cost = parseFloat(editData.cost) || 0;
    
    let kmsRecorridos = parseFloat(editData.distanceTraveled) || 0;
    if (endingKm > startingKm && !editData.distanceTraveled) {
      kmsRecorridos = endingKm - startingKm;
    }
    
    let precioCombustible = parseFloat(editData.pricePerGallon) || 0;
    if (!precioCombustible && gallons > 0 && cost > 0) {
      precioCombustible = cost / gallons;
    }
    
    let kmPerGallon = parseFloat(editData.fuelEfficiency) || 0;
    if (!kmPerGallon && gallons > 0 && kmsRecorridos > 0) {
      kmPerGallon = kmsRecorridos / gallons;
    }
    
    return {
      kmsRecorridos: kmsRecorridos.toFixed(2),
      precioCombustible: precioCombustible.toFixed(2),
      kmPerGallon: kmPerGallon.toFixed(2),
    };
  };

  const saveEdit = async (id: string) => {
    try {
      const calculated = calculateEditFields();
      let cost = parseFloat(editData.cost);
      const gallons = parseFloat(editData.gallons);
      const pricePerGallon = parseFloat(editData.pricePerGallon) || 0;
      
      // Si el precio por galón fue editado manualmente y difiere del calculado,
      // ajustar el costo para que coincida
      if (pricePerGallon > 0 && gallons > 0) {
        const calculatedPrice = cost / gallons;
        // Si hay una diferencia significativa (>0.01), usar el precio editado
        if (Math.abs(pricePerGallon - calculatedPrice) > 0.01) {
          cost = pricePerGallon * gallons;
        }
      }
      
      const updates: any = {
        vehicle_plate: editData.vehiclePlate,
        fuel_date: editData.fuelDate,
        gallons: gallons,
        cost: cost,
        starting_odometer: parseInt(editData.startingOdometer),
        ending_odometer: parseInt(editData.endingOdometer),
        distance_traveled: parseFloat(calculated.kmsRecorridos),
        fuel_efficiency: parseFloat(calculated.kmPerGallon),
        gas_station_name: editData.gasStationName,
      };

      await updateMutation.mutateAsync({ id, updates });
      setEditingId(null);
      setEditData({});
      alert('✅ Registro actualizado exitosamente');
    } catch (error: any) {
      alert(`Error al actualizar: ${error.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Columnas de la tabla
  const columns = [
    { key: 'vehicle_plate', label: 'Placa', sortable: true },
    {
      key: 'fuel_date',
      label: 'Fecha Tanqueo',
      render: (item: any) => format(new Date(item.fuel_date || item.date), 'dd/MM/yyyy'),
    },
    {
      key: 'starting_odometer',
      label: 'Km Inicial',
      render: (item: any) => item.starting_odometer || item.startingOdometer || '-',
    },
    {
      key: 'ending_odometer',
      label: 'Km Final',
      render: (item: any) => item.ending_odometer || item.endingOdometer || '-',
    },
    {
      key: 'distance_traveled',
      label: 'Kms Recorridos',
      render: (item: any) => {
        const start = item.starting_odometer || item.startingOdometer || 0;
        const end = item.ending_odometer || item.endingOdometer || 0;
        const distance = item.distance_traveled || (end - start);
        return distance ? `${distance.toFixed(2)} km` : '-';
      },
    },
    {
      key: 'gallons',
      label: 'Galones Tanqueo',
      render: (item: any) => `${item.gallons || 0} gal`,
    },
    {
      key: 'cost',
      label: 'Valor Tanqueo',
      render: (item: any) => `$${(item.cost || 0).toLocaleString('es-CO')}`,
    },
    {
      key: 'price_per_gallon',
      label: 'Precio Combustible',
      render: (item: any) => {
        const gallons = item.gallons || 0;
        const cost = item.cost || 0;
        const price = gallons > 0 ? cost / gallons : 0;
        return `$${price.toFixed(2)}/gal`;
      },
    },
    {
      key: 'fuel_efficiency',
      label: 'Km/Galon',
      render: (item: any) => {
        const efficiency = item.fuel_efficiency || 0;
        return efficiency > 0 ? `${efficiency.toFixed(2)} km/gal` : '-';
      },
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (item: any) => {
        const isEditing = editingId === item.id;
        if (!isAdmin) return '-';
        
        return isEditing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveEdit(item.id)}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="secondary" onClick={cancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
            <Edit2 className="h-3 w-3" />
          </Button>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Combustible</h1>
            <p className="mt-2 text-gray-600">
              Registra el consumo de combustible y recibos con cálculo automático de rendimiento
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Registrar Combustible'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <FuelIcon className="h-5 w-5 mr-2" />
                Registrar Combustible
              </h2>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Información del Equipo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Equipo Seleccionado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Placa del Vehículo</label>
                      <p className="text-lg font-bold text-blue-900">{selectedEquipment?.license_plate || 'No seleccionado'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Marca</label>
                      <p className="text-sm text-blue-800">{selectedEquipment?.brand || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Ubicación GPS */}
                <div className={`rounded-lg p-4 mb-4 border ${
                  latitude && longitude 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center">
                      <MapPin className={`h-4 w-4 mr-2 ${latitude && longitude ? 'text-green-600' : 'text-yellow-600'}`} />
                      Ubicación GPS
                    </h3>
                    {!geoLoading && (
                      <button
                        type="button"
                        onClick={refreshLocation}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Actualizar
                      </button>
                    )}
                  </div>
                  {geoLoading ? (
                    <p className="text-xs text-gray-600">Obteniendo ubicación...</p>
                  ) : latitude && longitude ? (
                    <p className="text-xs text-green-700">
                      ✓ Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-700">
                      ⚠ {geoError || 'Ubicación no disponible'}
                    </p>
                  )}
                </div>

                {/* Campos del formulario */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Fecha Tanqueo (Default: Hoy)"
                    value={formData.fuelDate}
                    onChange={(e) => setFormData({ ...formData, fuelDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Estación de Servicio"
                    placeholder="Ej: Terpel Centro"
                    value={formData.gasStationName}
                    onChange={(e) => setFormData({ ...formData, gasStationName: e.target.value })}
                    disabled={!isAdmin && formData.gasStationName !== ''}
                  />
                  <Input
                    type="number"
                    label="Km Inicial (Ingresa el conductor)"
                    placeholder="Ej: 50000"
                    value={formData.startingOdometer}
                    onChange={(e) => setFormData({ ...formData, startingOdometer: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Km Final (Ingresa el conductor al final)"
                    placeholder="Ej: 50250"
                    value={formData.endingOdometer}
                    onChange={(e) => setFormData({ ...formData, endingOdometer: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Galones Tanqueo (Extraído de foto)"
                    step="0.01"
                    placeholder="0.00 - Se extrae de la tirilla"
                    value={formData.gallons}
                    onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Valor Tanqueo (Extraído de foto)"
                    step="100"
                    placeholder="0 - Se extrae de la tirilla"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Precio Combustible (Extraído de foto)"
                    step="0.01"
                    placeholder="Se calcula automáticamente de la tirilla"
                    value={formData.pricePerGallon}
                    onChange={(e) => setFormData({ ...formData, pricePerGallon: e.target.value })}
                  />
                </div>

                {/* Campos calculados */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-indigo-900 mb-3">📊 Campos Calculados (Indicadores)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-indigo-700 font-medium">Kms Recorridos</label>
                      <p className="text-lg font-bold text-indigo-900">
                        {calculatedFields.kmsRecorridos} km
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-indigo-700 font-medium">Km/Galon (Indicador Principal)</label>
                      <p className="text-lg font-bold text-indigo-900">
                        {calculatedFields.kmPerGallon} km/gal
                      </p>
                    </div>
                  </div>
                </div>

                {/* Captura/Subida de Fotos */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Fotos de Tirillas de Tanqueo (Una foto por cada tirilla)
                  </label>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Instrucciones:</strong> 
                      <br />• Toma una foto de cada tirilla de tanqueo
                      <br />• Presiona "Extraer Datos (OCR)" para extraer galones, valor y precio automáticamente
                      <br />• Puedes agregar múltiples fotos si hay varias tirillas
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoCapture}
                      className="hidden"
                    />
                    
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Agregar Foto
                    </Button>

                    {receipt && (
                      <Button
                        type="button"
                        onClick={processReceiptOCR}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        {isProcessing ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            Procesando {progress}%
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Extraer Datos (OCR)
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Previsualización de fotos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {receiptPreview && (
                      <div className="border rounded-lg p-2 bg-gray-50 relative">
                        <button
                          type="button"
                          onClick={() => {
                            setReceipt(null);
                            setReceiptPreview('');
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <img 
                          src={receiptPreview} 
                          alt="Preview recibo" 
                          className="w-full max-h-64 object-contain rounded"
                        />
                        <p className="text-xs text-gray-600 mt-2 text-center">Foto Principal (OCR)</p>
                      </div>
                    )}
                    
                    {receiptPreviews.map((preview, index) => (
                      <div key={index} className="border rounded-lg p-2 bg-gray-50 relative">
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <img 
                          src={preview} 
                          alt={`Preview ${index + 1}`}
                          className="w-full max-h-64 object-contain rounded"
                        />
                        <p className="text-xs text-gray-600 mt-2 text-center">Tirilla {index + 1}</p>
                      </div>
                    ))}
                  </div>

                  {/* Input para múltiples fotos */}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleMultipleFiles(e.target.files)}
                    className="hidden"
                    id="multiple-photos"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => document.getElementById('multiple-photos')?.click()}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Agregar Múltiples Fotos
                  </Button>

                  {isProcessing && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader className="h-4 w-4 text-blue-600 animate-spin" />
                        <span className="text-sm text-blue-700">
                          Procesando recibo con OCR... {progress}%
                        </span>
                      </div>
                      <div className="mt-2 bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Usuario Admin:</strong> Puedes modificar TODOS los campos manualmente si es necesario, 
                      incluyendo campos calculados (Kms Recorridos, Precio Combustible, Km/Galon).
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={isUploading}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isUploading || !formData.gallons || !formData.cost}>
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Registro'
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                type="date"
                label="Fecha Inicio"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                label="Fecha Fin"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Input
                label="Filtrar por Placa"
                placeholder="Ej: ABC123"
                value={placaFilter}
                onChange={(e) => setPlacaFilter(e.target.value.toUpperCase())}
              />
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setPlacaFilter('');
                  }}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Tabla de historial */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              Historial de Combustible ({fuelLogsData?.total || 0})
            </h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isLoadingLogs ? (
              <div className="text-center py-8">
                <Loader className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">Cargando registros...</p>
              </div>
            ) : !fuelLogsData?.data || fuelLogsData.data.length === 0 ? (
              <div className="text-center py-12">
                <FuelIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No hay registros de combustible</p>
                <p className="text-sm text-gray-400">Haz clic en "Registrar Combustible" para agregar uno</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Placa</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Fecha Tanqueo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Km Inicial</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Km Final</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase bg-blue-50">Kms Recorridos</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Galones</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Valor Tanqueo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Precio Combustible</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase bg-indigo-50">Km/Galon</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fuelLogsData.data.map((record) => {
                      const isEditing = editingId === record.id;
                      const distanceTraveled = record.distance_traveled || (record.ending_odometer - record.starting_odometer);
                      const fuelEfficiency = record.fuel_efficiency || (record.gallons > 0 ? distanceTraveled / record.gallons : 0);
                      const pricePerGallon = record.gallons > 0 ? record.cost / record.gallons : 0;
                      
                      const editCalculated = isEditing ? calculateEditFields() : null;
                      
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {isEditing ? (
                              <Input
                                value={editData.vehiclePlate}
                                onChange={(e) => setEditData({ ...editData, vehiclePlate: e.target.value.toUpperCase() })}
                                className="w-20 text-xs"
                                placeholder="Placa"
                              />
                            ) : (
                              record.vehicle_plate
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editData.fuelDate}
                                onChange={(e) => setEditData({ ...editData, fuelDate: e.target.value })}
                                className="w-32 text-xs"
                              />
                            ) : (
                              format(new Date(record.fuel_date), 'dd/MM/yyyy')
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.startingOdometer}
                                onChange={(e) => setEditData({ ...editData, startingOdometer: e.target.value })}
                                className="w-24 text-xs"
                              />
                            ) : (
                              record.starting_odometer.toLocaleString()
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.endingOdometer}
                                onChange={(e) => setEditData({ ...editData, endingOdometer: e.target.value })}
                                className="w-24 text-xs"
                              />
                            ) : (
                              record.ending_odometer.toLocaleString()
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-700 bg-blue-50 font-mono">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.distanceTraveled}
                                onChange={(e) => setEditData({ ...editData, distanceTraveled: e.target.value })}
                                className="w-20 text-xs"
                              />
                            ) : (
                              `${distanceTraveled.toFixed(2)} km`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.gallons}
                                onChange={(e) => setEditData({ ...editData, gallons: e.target.value })}
                                className="w-20 text-xs"
                              />
                            ) : (
                              `${record.gallons.toFixed(2)} gal`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="100"
                                value={editData.cost}
                                onChange={(e) => setEditData({ ...editData, cost: e.target.value })}
                                className="w-24 text-xs"
                              />
                            ) : (
                              `$${record.cost.toLocaleString('es-CO')}`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.pricePerGallon}
                                onChange={(e) => setEditData({ ...editData, pricePerGallon: e.target.value })}
                                className="w-24 text-xs"
                              />
                            ) : (
                              `$${pricePerGallon.toFixed(2)}/gal`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-indigo-700 bg-indigo-50 font-mono font-bold">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.fuelEfficiency}
                                onChange={(e) => setEditData({ ...editData, fuelEfficiency: e.target.value })}
                                className="w-20 text-xs font-bold"
                              />
                            ) : (
                              `${fuelEfficiency.toFixed(2)} km/gal`
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" onClick={() => saveEdit(record.id)} disabled={updateMutation.isPending}>
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="secondary" onClick={cancelEdit}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : isAdmin ? (
                              <Button size="sm" variant="ghost" onClick={() => startEdit(record)}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
