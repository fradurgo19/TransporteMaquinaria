import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { TextArea } from '../atoms/TextArea';
import { Plus, Edit2, Trash2, Save, X, Fuel, Loader } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useManufacturerKPG, useManufacturerKPGMutation, ManufacturerKPG } from '../hooks/useManufacturerKPG';

export const ManufacturerKPGPage: React.FC = () => {
  useProtectedRoute(['admin', 'admin_logistics']); // Solo administradores

  const { data: kpgData, isLoading } = useManufacturerKPG();
  const { create, update, remove } = useManufacturerKPGMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    manufacturer: '',
    brand: '',
    model: '',
    vehicle_type: 'tractor',
    year: '',
    kpg: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      manufacturer: '',
      brand: '',
      model: '',
      vehicle_type: 'tractor',
      year: '',
      kpg: '',
      notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item: ManufacturerKPG) => {
    setFormData({
      manufacturer: item.manufacturer,
      brand: item.brand,
      model: item.model,
      vehicle_type: item.vehicle_type,
      year: item.year?.toString() || '',
      kpg: item.kpg.toString(),
      notes: item.notes || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.manufacturer || !formData.brand || !formData.model || !formData.kpg) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const data = {
        manufacturer: formData.manufacturer,
        brand: formData.brand,
        model: formData.model,
        vehicle_type: formData.vehicle_type,
        year: formData.year ? parseInt(formData.year) : null,
        kpg: parseFloat(formData.kpg),
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await update.mutateAsync({ id: editingId, data });
        alert('✅ KPG de fábrica actualizado exitosamente');
      } else {
        await create.mutateAsync(data);
        alert('✅ KPG de fábrica creado exitosamente');
      }

      resetForm();
    } catch (error: any) {
      console.error('Error saving manufacturer KPG:', error);
      alert(`Error: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro de KPG de fábrica?')) {
      return;
    }

    try {
      await remove.mutateAsync(id);
      alert('✅ KPG de fábrica eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting manufacturer KPG:', error);
      alert(`Error: ${error.message || 'Error desconocido'}`);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
              <Fuel className="h-6 w-6 sm:h-8 sm:w-8 mr-2 text-blue-600" />
              KPG de Fábrica
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Gestiona los KPG (Km/Galón) de fábrica según especificaciones del fabricante
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo KPG de Fábrica
          </Button>
        </div>

        {showForm && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-3 sm:p-4">
              <h2 className="text-base sm:text-lg font-semibold">
                {editingId ? 'Editar' : 'Nuevo'} KPG de Fábrica
              </h2>
            </CardHeader>
            <CardBody className="p-3 sm:p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Fabricante *"
                    placeholder="Ej: INTERNATIONAL, VOLVO, MACK"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value.toUpperCase() })}
                    required
                  />
                  <Input
                    label="Marca *"
                    placeholder="Ej: INTERNATIONAL"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                  />
                  <Input
                    label="Modelo *"
                    placeholder="Ej: LT625"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    required
                  />
                  <Select
                    label="Tipo de Vehículo *"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    options={[
                      { value: 'tractor', label: 'Tractor' },
                      { value: 'trailer', label: 'Trailer' },
                      { value: 'van', label: 'Van' },
                      { value: 'truck', label: 'Truck' },
                    ]}
                    required
                  />
                  <Input
                    type="number"
                    label="Año (Opcional)"
                    placeholder="Ej: 2020"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    min="1900"
                    max="2100"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    label="KPG (Km/Galón) *"
                    placeholder="Ej: 8.5"
                    value={formData.kpg}
                    onChange={(e) => setFormData({ ...formData, kpg: e.target.value })}
                    required
                  />
                </div>
                <TextArea
                  label="Notas (Opcional)"
                  placeholder="Información adicional sobre este KPG de fábrica"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={resetForm} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={create.isPending || update.isPending} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                    {create.isPending || update.isPending ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader className="p-3 sm:p-4">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
              Registros de KPG de Fábrica ({kpgData?.length || 0})
            </h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">Cargando registros...</p>
              </div>
            ) : !kpgData || kpgData.length === 0 ? (
              <div className="text-center py-12">
                <Fuel className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No hay registros de KPG de fábrica</p>
                <p className="text-sm text-gray-400">Haz clic en "Nuevo KPG de Fábrica" para agregar uno</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-[10px] sm:text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Fabricante</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Marca</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Modelo</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Tipo</th>
                      <th className="px-2 sm:px-4 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">Año</th>
                      <th className="px-2 sm:px-4 py-3 text-right font-medium text-gray-500 uppercase whitespace-nowrap">KPG</th>
                      <th className="px-2 sm:px-4 py-3 text-center font-medium text-gray-500 uppercase whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {kpgData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900">{item.manufacturer}</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-700">{item.brand}</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-700">{item.model}</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-700 capitalize">{item.vehicle_type}</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-gray-700">{item.year || '-'}</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-right font-bold text-blue-900">{item.kpg.toFixed(2)} km/gal</td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              className="p-1"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                              disabled={remove.isPending}
                              className="p-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

