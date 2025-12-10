import React, { useState, useEffect } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { DataTable } from '../organisms/DataTable';
import { Plus, Truck, Loader, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { executeSupabaseQuery } from '../services/supabaseInterceptor';
import { format } from 'date-fns';
import { sendTransportRequestNotification } from '../services/transportRequestNotifications';

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
}

interface TransportRequest {
  id: string;
  serie: string;
  descripcion: string;
  marca: string;
  modelo: string;
  nombre_destinatario: string;
  direccion: string;
  ciudad: string;
  celular: string;
  origen_cargue: string;
  fecha_entrega: string;
  persona_entrega: string;
  vb_ingeniero: boolean;
  status: string;
  created_at: string;
}

export const TransportRequestsPage: React.FC = () => {
  useProtectedRoute(['admin', 'user', 'commercial']);
  const { user } = useAuth();
  const isCommercial = user?.role === 'commercial';
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_logistics';
  const canCreateRequests = isCommercial || isAdmin; // Administradores también pueden crear

  const [showForm, setShowForm] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    serie: '',
    descripcion: '',
    marca: '',
    modelo: '',
    ancho: '',
    alto: '',
    largo: '',
    peso: '',
    nombre_destinatario: '',
    direccion: '',
    celular: '',
    ciudad: '',
    origen_cargue: '',
    fecha_entrega: '',
    persona_entrega: '',
    vb_ingeniero: false,
    notes: '',
  });

  // Cargar máquinas
  useEffect(() => {
    loadMachines();
  }, []);

  // Cargar solicitudes
  useEffect(() => {
    loadRequests();
  }, []);

  const loadMachines = async () => {
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
    }
  };

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('transport_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Comerciales solo ven las suyas, admins ven todas
      if (isCommercial && !isAdmin) {
        query = query.eq('requested_by', user?.id);
      }
      // Los admins ya ven todas las solicitudes por la política RLS

      const result = await executeSupabaseQuery(() => query);

      if (result.data) {
        setRequests(result.data as TransportRequest[]);
      }
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSerieChange = (serie: string) => {
    const machine = machines.find(m => m.serie === serie);
    
    if (machine) {
      setSelectedMachine(machine);
      setFormData({
        ...formData,
        serie: machine.serie,
        descripcion: machine.descripcion || '',
        marca: machine.marca || '',
        modelo: machine.modelo || '',
        ancho: machine.ancho?.toString() || '',
        alto: machine.alto?.toString() || '',
        largo: machine.largo?.toString() || '',
        peso: machine.peso?.toString() || '',
      });
    } else {
      setSelectedMachine(null);
      setFormData({
        ...formData,
        serie: serie,
        descripcion: '',
        marca: '',
        modelo: '',
        ancho: '',
        alto: '',
        largo: '',
        peso: '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Usuario no autenticado');
      return;
    }

    if (!selectedMachine) {
      alert('Selecciona una máquina válida');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await executeSupabaseQuery(() =>
        supabase
          .from('transport_requests')
          .insert([{
            machine_id: selectedMachine.id,
            serie: formData.serie,
            descripcion: formData.descripcion,
            marca: formData.marca,
            modelo: formData.modelo,
            ancho: formData.ancho ? parseFloat(formData.ancho) : null,
            alto: formData.alto ? parseFloat(formData.alto) : null,
            largo: formData.largo ? parseFloat(formData.largo) : null,
            peso: formData.peso ? parseFloat(formData.peso) : null,
            nombre_destinatario: formData.nombre_destinatario,
            direccion: formData.direccion,
            celular: formData.celular,
            ciudad: formData.ciudad,
            origen_cargue: formData.origen_cargue,
            fecha_entrega: formData.fecha_entrega || null,
            persona_entrega: formData.persona_entrega || null,
            vb_ingeniero: formData.vb_ingeniero,
            requested_by: user.id,
            status: 'pending',
            notes: formData.notes || null,
          }])
          .select()
          .single()
      );

      if (error) throw error;

      // Enviar notificación
      try {
        await sendTransportRequestNotification(data.id);
      } catch (notifError) {
        console.error('Error enviando notificación:', notifError);
        // No bloquear el proceso si falla la notificación
      }

      alert('✅ Solicitud de transporte creada exitosamente');
      
      // Limpiar formulario
      setFormData({
        serie: '',
        descripcion: '',
        marca: '',
        modelo: '',
        ancho: '',
        alto: '',
        largo: '',
        peso: '',
        nombre_destinatario: '',
        direccion: '',
        celular: '',
        ciudad: '',
        origen_cargue: '',
        fecha_entrega: '',
        persona_entrega: '',
        vb_ingeniero: false,
        notes: '',
      });
      setSelectedMachine(null);
      setShowForm(false);
      loadRequests();
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { key: 'serie', label: 'Serie', sortable: true },
    { key: 'marca', label: 'Marca', sortable: true },
    { key: 'modelo', label: 'Modelo' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'nombre_destinatario', label: 'Destinatario' },
    { key: 'ciudad', label: 'Ciudad' },
    {
      key: 'fecha_entrega',
      label: 'Fecha Entrega',
      render: (item: TransportRequest) => 
        item.fecha_entrega ? format(new Date(item.fecha_entrega), 'dd/MM/yyyy') : '-',
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: TransportRequest) => {
        const statusConfig = {
          pending: { icon: Clock, color: 'text-yellow-600', label: 'Pendiente' },
          approved: { icon: CheckCircle, color: 'text-green-600', label: 'Aprobada' },
          in_progress: { icon: Loader, color: 'text-blue-600', label: 'En Progreso' },
          completed: { icon: CheckCircle, color: 'text-green-600', label: 'Completada' },
          cancelled: { icon: XCircle, color: 'text-red-600', label: 'Cancelada' },
        };
        const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pending;
        const Icon = config.icon;
        return (
          <span className={`flex items-center ${config.color}`}>
            <Icon className="h-4 w-4 mr-1" />
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Fecha Solicitud',
      render: (item: TransportRequest) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm'),
    },
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'approved', label: 'Aprobada' },
    { value: 'in_progress', label: 'En Progreso' },
    { value: 'completed', label: 'Completada' },
    { value: 'cancelled', label: 'Cancelada' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Transporte</h1>
            <p className="mt-1 text-sm text-gray-600">
              {canCreateRequests ? 'Solicita el transporte de equipos' : 'Gestiona las solicitudes de transporte'}
            </p>
          </div>
          {canCreateRequests && (
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {showForm ? 'Cancelar' : 'Nueva Solicitud'}
            </Button>
          )}
        </div>

        {showForm && canCreateRequests && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
              <h2 className="text-lg font-semibold flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                Nueva Solicitud de Transporte
              </h2>
            </CardHeader>
            <CardBody className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Información de la Máquina */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-600 rounded-r-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">
                    Información del Equipo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-blue-700 font-medium mb-1">
                        Serie <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.serie}
                        onChange={(e) => handleSerieChange(e.target.value)}
                        className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecciona una serie</option>
                        {machines.map((machine) => (
                          <option key={machine.id} value={machine.serie}>
                            {machine.serie} - {machine.marca} {machine.modelo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Input
                        label="Descripción"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <Input
                        label="Marca"
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <Input
                        label="Modelo"
                        value={formData.modelo}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="Ancho (m)"
                        type="number"
                        step="0.01"
                        value={formData.ancho}
                        onChange={(e) => setFormData({ ...formData, ancho: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                      <Input
                        label="Alto (m)"
                        type="number"
                        step="0.01"
                        value={formData.alto}
                        onChange={(e) => setFormData({ ...formData, alto: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                      <Input
                        label="Largo (m)"
                        type="number"
                        step="0.01"
                        value={formData.largo}
                        onChange={(e) => setFormData({ ...formData, largo: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <Input
                        label="Peso (kg)"
                        type="number"
                        step="0.01"
                        value={formData.peso}
                        onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos de Envío */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Datos de Envío
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label="Nombre Destinatario"
                      value={formData.nombre_destinatario}
                      onChange={(e) => setFormData({ ...formData, nombre_destinatario: e.target.value })}
                      required
                    />
                    <Input
                      label="Celular"
                      value={formData.celular}
                      onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                      required
                    />
                    <div className="md:col-span-2">
                      <Input
                        label="Dirección"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        required
                      />
                    </div>
                    <Input
                      label="Ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Datos de Cargue y Otros */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Datos de Cargue y Entrega
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        label="Origen de Cargue"
                        value={formData.origen_cargue}
                        onChange={(e) => setFormData({ ...formData, origen_cargue: e.target.value })}
                        required
                      />
                    </div>
                    <Input
                      label="Fecha de Entrega"
                      type="date"
                      value={formData.fecha_entrega}
                      onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                    />
                    <Input
                      label="Persona que Entrega"
                      value={formData.persona_entrega}
                      onChange={(e) => setFormData({ ...formData, persona_entrega: e.target.value })}
                    />
                    <div className="md:col-span-2">
                      <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-lg p-3">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.vb_ingeniero}
                            onChange={(e) => setFormData({ ...formData, vb_ingeniero: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-900">
                            Visto Bueno de Ingeniero
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <TextArea
                        label="Notas Adicionales"
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Información adicional sobre la solicitud..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar Solicitud'
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Historial de Solicitudes</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={requests}
              columns={columns}
              emptyMessage="No hay solicitudes de transporte"
              isLoading={isLoading}
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
