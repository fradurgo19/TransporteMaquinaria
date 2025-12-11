import React, { useState, useRef, useEffect } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Plus, Fuel as FuelIcon, Camera, Wand2, Loader, X, Edit2, Save } from 'lucide-react';
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
  const { latitude, longitude } = useGeolocation();
  const { extractDataFromReceipt, isProcessing, progress } = useOCR();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [placaFilter, setPlacaFilter] = useState('');
  const [currentPage] = useState(1);

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
          vehiclePlate: result.vehiclePlate || prev.vehiclePlate,
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
      // Limpiar la fecha (puede tener espacios o caracteres extra)
      const cleanDate = dateStr.trim().replace(/\s+/g, '');
      const parts = cleanDate.split(/[-/]/);
      
      if (parts.length === 3) {
        let year, month, day;
        
        // Detectar formato YYYY/MM/DD o YYYY-MM-DD
        if (parts[0].length === 4) {
          // Formato: YYYY/MM/DD
          [year, month, day] = parts;
        } else {
          // Formato: DD/MM/YYYY o MM/DD/YYYY
          // Intentar ambos formatos
          const firstNum = parseInt(parts[0]);
          const secondNum = parseInt(parts[1]);
          
          if (firstNum > 12) {
            // DD/MM/YYYY
            [day, month, year] = parts;
          } else if (secondNum > 12) {
            // MM/DD/YYYY
            [month, day, year] = parts;
          } else {
            // Asumir DD/MM/YYYY (formato más común en Colombia)
            [day, month, year] = parts;
          }
        }
        
        // Normalizar año
        const fullYear = year.length === 2 ? `20${year}` : year;
        
        // Validar y formatear
        const yearNum = parseInt(fullYear);
        const monthNum = parseInt(month);
        const dayNum = parseInt(day);
        
        if (yearNum >= 2000 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
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
      let photoUrl: string | null = null;
      
      // Subir solo una foto
      if (receipt) {
        console.log('📤 Comprimiendo y subiendo foto...');
        const compressed = await compressImage(receipt);
        const upload = await uploadFile(
          compressed, 
          'fuel-receipts', 
          `${selectedEquipment.license_plate}_${Date.now()}`
        );
        
        if (upload) {
          photoUrl = upload.url;
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
          receipt_photo_path: photoUrl || null,
          receipt_photo_url: photoUrl || null,
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


  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Gestión de Combustible</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 hidden sm:block">
              Registra el consumo de combustible y recibos con cálculo automático de rendimiento
            </p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-sm">{showForm ? 'Cancelar' : 'Registrar Combustible'}</span>
          </Button>
        </div>

        {showForm && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="bg-gradient-to-r text-white p-3 sm:p-4" style={{ background: 'linear-gradient(to right, #cf1b22, #cf1b22)' }}>
              <h2 className="text-base sm:text-lg font-semibold flex items-center">
                <FuelIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Registrar Combustible
              </h2>
            </CardHeader>
            <CardBody className="p-3 sm:p-4">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Foto primero */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Foto de Tirilla de Tanqueo
                  </label>
                  
                  {receiptPreview ? (
                    <div className="relative border-2 rounded-lg p-2" style={{ borderColor: '#cf1b22', backgroundColor: '#FFFFFF' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReceipt(null);
                          setReceiptPreview('');
                        }}
                        className="absolute top-2 right-2 rounded-full p-1 z-10 text-white hover:opacity-90"
                        style={{ backgroundColor: '#cf1b22' }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <img 
                        src={receiptPreview} 
                        alt="Preview recibo" 
                        className="w-full max-h-48 object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#cf1b22', backgroundColor: '#FFFFFF' }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        className="hidden"
                      />
                      <Camera className="h-8 w-8 mx-auto mb-2" style={{ color: '#cf1b22' }} />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-white hover:opacity-90"
                        style={{ backgroundColor: '#cf1b22' }}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Tomar/Subir Foto
                      </Button>
                    </div>
                  )}

                  {receipt && (
                    <Button
                      type="button"
                      onClick={processReceiptOCR}
                      disabled={isProcessing}
                      size="sm"
                      className="w-full text-white hover:opacity-90"
                      style={{ backgroundColor: '#cf1b22' }}
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

                  {isProcessing && (
                    <div className="rounded-lg p-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid #50504f' }}>
                      <div className="flex items-center gap-2">
                        <Loader className="h-4 w-4 animate-spin" style={{ color: '#cf1b22' }} />
                        <span className="text-xs" style={{ color: '#50504f' }}>
                          Procesando recibo con OCR... {progress}%
                        </span>
                      </div>
                      <div className="mt-1 rounded-full h-1.5" style={{ backgroundColor: '#50504f' }}>
                        <div 
                          className="h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%`, backgroundColor: '#cf1b22' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Información del Equipo */}
                <div className="rounded-lg p-2 sm:p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #50504f' }}>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-[10px] sm:text-xs font-medium" style={{ color: '#50504f' }}>Placa:</span>
                      <p className="font-bold text-sm sm:text-base" style={{ color: '#cf1b22' }}>{selectedEquipment?.license_plate || 'No seleccionado'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs font-medium" style={{ color: '#50504f' }}>Marca:</span>
                      <p className="text-sm sm:text-base" style={{ color: '#50504f' }}>{selectedEquipment?.brand || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Campos del formulario */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="date"
                    label="Fecha Tanqueo"
                    value={formData.fuelDate}
                    onChange={(e) => setFormData({ ...formData, fuelDate: e.target.value })}
                    required
                    className="text-sm"
                  />
                  <Input
                    label="Estación de Servicio"
                    placeholder="Ej: Terpel"
                    value={formData.gasStationName}
                    onChange={(e) => setFormData({ ...formData, gasStationName: e.target.value })}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    label="Km Inicial"
                    placeholder="50000"
                    value={formData.startingOdometer}
                    onChange={(e) => setFormData({ ...formData, startingOdometer: e.target.value })}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    label="Km Final"
                    placeholder="50250"
                    value={formData.endingOdometer}
                    onChange={(e) => setFormData({ ...formData, endingOdometer: e.target.value })}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    label="Galones"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.gallons}
                    onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    label="Valor Tanqueo"
                    step="100"
                    placeholder="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    label="Precio Combustible"
                    step="0.01"
                    placeholder="Auto"
                    value={formData.pricePerGallon}
                    onChange={(e) => setFormData({ ...formData, pricePerGallon: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={isUploading} className="w-full sm:w-auto" style={{ backgroundColor: '#50504f', color: '#FFFFFF' }}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isUploading || !formData.gallons || !formData.cost} className="w-full sm:w-auto text-white hover:opacity-90" style={{ backgroundColor: '#cf1b22' }}>
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar'
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardBody className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <CardHeader className="p-3 sm:p-4">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
              Historial de Combustible ({fuelLogsData?.total || 0})
            </h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto -mx-3 sm:mx-0">
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
                <table className="min-w-full divide-y divide-gray-200 text-[10px] sm:text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Placa</th>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Fecha</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">Km Inicial</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">Km Final</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase bg-blue-50 whitespace-nowrap">Kms</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase whitespace-nowrap">Gal</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase whitespace-nowrap">Valor</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase whitespace-nowrap hidden md:table-cell">Precio</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 uppercase bg-indigo-50 whitespace-nowrap">Km/Gal</th>
                      <th className="px-2 sm:px-3 py-2 text-center font-medium text-gray-500 uppercase whitespace-nowrap">Acc</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fuelLogsData.data.map((record) => {
                      const isEditing = editingId === record.id;
                      const distanceTraveled = record.distance_traveled || (record.ending_odometer - record.starting_odometer);
                      const fuelEfficiency = record.fuel_efficiency || (record.gallons > 0 ? distanceTraveled / record.gallons : 0);
                      const pricePerGallon = record.gallons > 0 ? record.cost / record.gallons : 0;
                      
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-3 py-2 font-semibold text-gray-900 text-xs sm:text-sm">
                            {isEditing ? (
                              <Input
                                value={editData.vehiclePlate}
                                onChange={(e) => setEditData({ ...editData, vehiclePlate: e.target.value.toUpperCase() })}
                                className="w-16 sm:w-20 text-[10px] sm:text-xs"
                                placeholder="Placa"
                              />
                            ) : (
                              record.vehicle_plate
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-gray-700 text-[10px] sm:text-xs whitespace-nowrap">
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editData.fuelDate}
                                onChange={(e) => setEditData({ ...editData, fuelDate: e.target.value })}
                                className="w-24 sm:w-32 text-[10px] sm:text-xs"
                              />
                            ) : (
                              format(new Date(record.fuel_date), 'dd/MM/yyyy')
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-gray-700 text-[10px] sm:text-xs hidden sm:table-cell">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.startingOdometer}
                                onChange={(e) => setEditData({ ...editData, startingOdometer: e.target.value })}
                                className="w-20 sm:w-24 text-[10px] sm:text-xs"
                              />
                            ) : (
                              record.starting_odometer.toLocaleString()
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-gray-700 text-[10px] sm:text-xs hidden sm:table-cell">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.endingOdometer}
                                onChange={(e) => setEditData({ ...editData, endingOdometer: e.target.value })}
                                className="w-20 sm:w-24 text-[10px] sm:text-xs"
                              />
                            ) : (
                              record.ending_odometer.toLocaleString()
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-blue-700 bg-blue-50 font-mono text-[10px] sm:text-xs">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.distanceTraveled}
                                onChange={(e) => setEditData({ ...editData, distanceTraveled: e.target.value })}
                                className="w-16 sm:w-20 text-[10px] sm:text-xs"
                              />
                            ) : (
                              `${distanceTraveled.toFixed(1)}`
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-gray-700 text-[10px] sm:text-xs">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.gallons}
                                onChange={(e) => setEditData({ ...editData, gallons: e.target.value })}
                                className="w-16 sm:w-20 text-[10px] sm:text-xs"
                              />
                            ) : (
                              `${record.gallons.toFixed(1)}`
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-gray-700 text-[10px] sm:text-xs whitespace-nowrap">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="100"
                                value={editData.cost}
                                onChange={(e) => setEditData({ ...editData, cost: e.target.value })}
                                className="w-20 sm:w-24 text-[10px] sm:text-xs"
                              />
                            ) : (
                              `$${(record.cost / 1000).toFixed(0)}k`
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-gray-700 text-[10px] sm:text-xs hidden md:table-cell">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.pricePerGallon}
                                onChange={(e) => setEditData({ ...editData, pricePerGallon: e.target.value })}
                                className="w-20 sm:w-24 text-[10px] sm:text-xs"
                              />
                            ) : (
                              `$${pricePerGallon.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-right text-indigo-700 bg-indigo-50 font-mono font-bold text-[10px] sm:text-xs">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.fuelEfficiency}
                                onChange={(e) => setEditData({ ...editData, fuelEfficiency: e.target.value })}
                                className="w-16 sm:w-20 text-[10px] sm:text-xs font-bold"
                              />
                            ) : (
                              `${fuelEfficiency.toFixed(1)}`
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-center">
                            {isEditing ? (
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" onClick={() => saveEdit(record.id)} disabled={updateMutation.isPending} className="p-1">
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="secondary" onClick={cancelEdit} className="p-1">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : isAdmin ? (
                              <Button size="sm" variant="ghost" onClick={() => startEdit(record)} className="p-1">
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
