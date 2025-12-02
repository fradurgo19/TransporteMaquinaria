import React, { useState, useRef } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FileUpload } from '../molecules/FileUpload';
import { DataTable } from '../organisms/DataTable';
import { Plus, Fuel as FuelIcon, MapPin, Camera, Upload, Wand2, Loader } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useOCR } from '../hooks/useOCR';
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
  const [isUploading, setIsUploading] = useState(false);
  
  // Estados del formulario con valores por defecto
  const [formData, setFormData] = useState({
    vehiclePlate: selectedEquipment?.license_plate || '',
    fuelDate: format(new Date(), 'yyyy-MM-dd'),
    gallons: '',
    cost: '',
    startingOdometer: '',
    endingOdometer: '',
    gasStationName: '',
    receiptPhotoUrl: '',
  });

  const mockFuelLogs = [
    {
      id: '1',
      vehiclePlate: 'ABC-123',
      date: '2025-10-21',
      gallons: 45.5,
      cost: 205.50,
      startingOdometer: 125430,
      endingOdometer: 125780,
    },
  ];

  const handleFileChange = async (file: File | null) => {
    setReceipt(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview('');
    }
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

      // Auto-llenar formulario con datos extraídos
      setFormData(prev => ({
        ...prev,
        gallons: result.gallons || prev.gallons,
        cost: result.cost || prev.cost,
        fuelDate: result.date ? formatDateFromOCR(result.date) : prev.fuelDate,
      }));

      alert('✅ Datos extraídos del recibo. Verifica y ajusta si es necesario.');
    } catch (error) {
      console.error('Error en OCR:', error);
      alert('Error al procesar la imagen. Intenta con mejor iluminación.');
    }
  };

  const formatDateFromOCR = (dateStr: string): string => {
    // Intentar convertir formato de fecha extraído a YYYY-MM-DD
    try {
      // Si viene en formato DD/MM/YYYY o DD-MM-YYYY
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

  const columns = [
    { key: 'vehiclePlate', label: 'Vehicle', sortable: true },
    {
      key: 'date',
      label: 'Date',
      render: (item: any) => format(new Date(item.date), 'MMM dd, yyyy'),
    },
    {
      key: 'gallons',
      label: 'Gallons',
      render: (item: any) => `${item.gallons} gal`,
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (item: any) => `$${item.cost.toFixed(2)}`,
    },
    { key: 'startingOdometer', label: 'Start ODO' },
    { key: 'endingOdometer', label: 'End ODO' },
    {
      key: 'distance',
      label: 'Distance',
      render: (item: any) => `${item.endingOdometer - item.startingOdometer} km`,
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Combustible</h1>
            <p className="mt-2 text-gray-600">
              Registra el consumo de combustible y recibos
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
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                
                if (!selectedEquipment || !user) {
                  alert('Selecciona un equipo primero');
                  return;
                }

                setIsUploading(true);
                
                try {
                  let receiptUrl = '';
                  
                  // Subir foto si existe
                  if (receipt) {
                    console.log('📤 Comprimiendo y subiendo foto...');
                    const compressed = await compressImage(receipt);
                    const upload = await uploadFile(
                      compressed, 
                      'fuel-receipts', 
                      selectedEquipment.license_plate
                    );
                    
                    if (upload) {
                      receiptUrl = upload.url;
                      console.log('✅ Foto subida:', receiptUrl);
                    }
                  }

                  // Guardar en Supabase
                  const { data, error } = await supabase
                    .from('fuel_logs')
                    .insert([{
                      vehicle_plate: selectedEquipment.license_plate,
                      fuel_date: formData.fuelDate,
                      gallons: parseFloat(formData.gallons),
                      cost: parseFloat(formData.cost),
                      starting_odometer: parseInt(formData.startingOdometer),
                      ending_odometer: parseInt(formData.endingOdometer),
                      gas_station_name: formData.gasStationName,
                      receipt_photo_url: receiptUrl,
                      location_latitude: latitude || 4.6097,
                      location_longitude: longitude || -74.0817,
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
                    startingOdometer: '',
                    endingOdometer: '',
                    gasStationName: '',
                    receiptPhotoUrl: '',
                  });
                  setReceipt(null);
                  setReceiptPreview('');
                  setShowForm(false);
                } catch (error: any) {
                  console.error('Error:', error);
                  alert(`Error al guardar: ${error.message}`);
                } finally {
                  setIsUploading(false);
                }
              }}>
                {/* Información del Equipo (Solo lectura) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Equipo Seleccionado</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Placa del Vehículo</label>
                      <p className="text-lg font-bold text-blue-900">{selectedEquipment?.license_plate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Marca</label>
                      <p className="text-sm text-blue-800">{selectedEquipment?.brand}</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Fecha"
                    value={formData.fuelDate}
                    onChange={(e) => setFormData({ ...formData, fuelDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Estación de Servicio"
                    placeholder="Ej: Terpel Centro"
                    value={formData.gasStationName}
                    onChange={(e) => setFormData({ ...formData, gasStationName: e.target.value })}
                  />
                  <Input
                    type="number"
                    label="Galones"
                    step="0.1"
                    placeholder="0.0"
                    value={formData.gallons}
                    onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Costo (COP $)"
                    step="100"
                    placeholder="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Odómetro Inicial"
                    placeholder="0"
                    value={formData.startingOdometer}
                    onChange={(e) => setFormData({ ...formData, startingOdometer: e.target.value })}
                    required
                  />
                  <Input
                    type="number"
                    label="Odómetro Final"
                    placeholder="0"
                    value={formData.endingOdometer}
                    onChange={(e) => setFormData({ ...formData, endingOdometer: e.target.value })}
                    required
                  />
                </div>
                {/* Captura/Subida de Foto */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Foto del Recibo con OCR Automático
                  </label>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Instrucciones:</strong> Toma foto del recibo → Presiona "Extraer Datos" → 
                      Los campos se llenan automáticamente (galones, costo, fecha)
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
                      Tomar Foto
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
                            Extraer Datos
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {receiptPreview && (
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <img 
                        src={receiptPreview} 
                        alt="Preview recibo" 
                        className="w-full max-h-64 object-contain rounded"
                      />
                    </div>
                  )}

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

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Historial de Combustible</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={mockFuelLogs}
              columns={columns}
              emptyMessage="No hay registros de combustible"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
