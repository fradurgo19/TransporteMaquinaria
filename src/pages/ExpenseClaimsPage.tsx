import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, Receipt, Camera, Wand2, Loader, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useEquipment } from '../context/EquipmentContext';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useOCR } from '../hooks/useOCR';
import { format, parseISO } from 'date-fns';

interface ExpenseClaim {
  id: string;
  vehicle_plate: string;
  driver_name: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export const ExpenseClaimsPage: React.FC = () => {
  useProtectedRoute(['admin', 'user']);
  const { user } = useAuth();
  const { selectedEquipment } = useEquipment();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const { extractDataFromReceipt, isProcessing, progress } = useOCR();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  
  const [formData, setFormData] = useState({
    expenseType: 'alimentacion',
    expenseDate: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    description: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, [selectedEquipment]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expense_claims?vehicle_plate=eq.${selectedEquipment?.license_plate}&order=expense_date.desc&limit=50`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error('Error cargando viáticos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceipt(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceiptOCR = async () => {
    if (!receipt) {
      alert('Primero toma una foto del recibo');
      return;
    }

    try {
      const result = await extractDataFromReceipt(receipt);
      
      setFormData(prev => ({
        ...prev,
        amount: result.cost || prev.amount,
        expenseDate: result.date ? formatDateFromOCR(result.date) : prev.expenseDate,
      }));

      alert('✅ Datos extraídos. Verifica y ajusta si es necesario.');
    } catch (error) {
      console.error('Error en OCR:', error);
      alert('Error al procesar. Intenta con mejor iluminación.');
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
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const payload = {
        vehicle_plate: selectedEquipment?.license_plate,
        driver_name: user?.full_name || user?.username,
        expense_date: formData.expenseDate,
        expense_type: formData.expenseType,
        amount: parseFloat(formData.amount),
        description: formData.description,
        gps_latitude: latitude || 4.6097,
        gps_longitude: longitude || -74.0817,
        status: 'pending',
        created_by: user?.id,
      };

      console.log('💰 Guardando viático:', payload);

      const response = await fetch(
        `${supabaseUrl}/rest/v1/expense_claims`,
        {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        console.log('✅ Viático guardado');
        setShowForm(false);
        setReceipt(null);
        setReceiptPreview('');
        setFormData({
          expenseType: 'alimentacion',
          expenseDate: format(new Date(), 'yyyy-MM-dd'),
          amount: '',
          description: '',
        });
        await fetchExpenses();
      } else {
        const errorData = await response.json();
        console.error('❌ Error:', errorData);
        alert('Error al guardar viático');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al guardar viático');
    }
  };

  const getTypeLabel = (type: string) => {
    const types = {
      alimentacion: 'Alimentación',
      hotel: 'Hotel',
      gastos_varios: 'Gastos Varios',
    };
    return types[type as keyof typeof types] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge variant="success">Aprobado</Badge>;
    if (status === 'rejected') return <Badge variant="error">Rechazado</Badge>;
    return <Badge variant="warning">Pendiente</Badge>;
  };

  const columns = [
    {
      key: 'expense_date',
      label: 'Fecha',
      render: (item: ExpenseClaim) => format(parseISO(item.expense_date), 'dd/MM/yyyy'),
    },
    {
      key: 'expense_type',
      label: 'Tipo',
      render: (item: ExpenseClaim) => getTypeLabel(item.expense_type),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (item: ExpenseClaim) => `$${item.amount.toLocaleString('es-CO')}`,
    },
    { key: 'description', label: 'Descripción' },
    {
      key: 'status',
      label: 'Estado',
      render: (item: ExpenseClaim) => getStatusBadge(item.status),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Viáticos</h1>
            <p className="mt-2 text-gray-600">
              Registra gastos de alimentación, hoteles y otros
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nuevo Viático'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Receipt className="h-5 w-5 mr-2" />
                Registrar Viático
              </h2>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Información del Equipo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Información</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Vehículo</label>
                      <p className="text-lg font-bold text-blue-900">{selectedEquipment?.license_plate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-blue-700 font-medium">Conductor</label>
                      <p className="text-lg font-bold text-blue-900">{user?.full_name || user?.username}</p>
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

                {/* Captura y OCR */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Foto del Recibo con OCR Automático
                  </label>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Instrucciones:</strong> Toma foto del recibo → Presiona "Extraer Datos" → 
                      Los campos se llenan automáticamente
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
                            {progress}%
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
                        alt="Preview" 
                        className="w-full max-h-64 object-contain rounded"
                      />
                    </div>
                  )}

                  {isProcessing && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader className="h-4 w-4 text-blue-600 animate-spin" />
                        <span className="text-sm text-blue-700">
                          Procesando recibo... {progress}%
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Tipo de Gasto"
                    value={formData.expenseType}
                    onChange={(e) => setFormData({ ...formData, expenseType: e.target.value })}
                    options={[
                      { value: 'alimentacion', label: 'Alimentación' },
                      { value: 'hotel', label: 'Hotel' },
                      { value: 'gastos_varios', label: 'Gastos Varios' },
                    ]}
                    required
                  />
                  
                  <Input
                    type="date"
                    label="Fecha del Gasto"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    required
                  />

                  <Input
                    type="number"
                    label="Valor (COP $)"
                    step="100"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <TextArea
                  label="Descripción"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles del gasto..."
                />

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Guardar Viático
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Historial de Viáticos</h2>
              {isLoading && <span className="text-sm text-gray-500">Cargando...</span>}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={expenses}
              columns={columns}
              emptyMessage="No hay viáticos registrados"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};

