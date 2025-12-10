import React, { useState } from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { RefreshCw, Download, Upload, Edit2, Save, X, FileSpreadsheet, MapPin } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { format, parseISO } from 'date-fns';
import { useOvertimeTracking, useSyncOvertimeTracking, useUpdateOvertimeTracking, OvertimeTracking } from '../hooks/useOvertimeTracking';
import { parseGPSExcel, uploadGPSData, analyzeAndUpdateRoute, validateGPSExcel, processMultiDayGPSExcel, MultiDayProcessResult } from '../services/gpsService';
import { GPSRouteMap } from '../components/GPSRouteMap';
import { supabase } from '../services/supabase';

export const OvertimeTrackingPage: React.FC = () => {
  useProtectedRoute(['admin']);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [placaFilter, setPlacaFilter] = useState('');
  const [currentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ ubicacion: string; actividad: string }>({ ubicacion: '', actividad: '' });
  const [uploadingGPS, setUploadingGPS] = useState<string | null>(null);
  const [viewingMap, setViewingMap] = useState<string | null>(null);
  const [uploadingMultiDay, setUploadingMultiDay] = useState(false);
  const [multiDayResult, setMultiDayResult] = useState<MultiDayProcessResult | null>(null);

  const { data: overtimeData, isLoading } = useOvertimeTracking({
    page: currentPage,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    placa: placaFilter || undefined,
  });

  const syncMutation = useSyncOvertimeTracking();
  const updateMutation = useUpdateOvertimeTracking();

  const overtimeRecords = overtimeData?.data || [];

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      alert(`✅ ${result.synced} registros sincronizados desde Operation Hours`);
    } catch (error: any) {
      alert(`Error al sincronizar: ${error.message}`);
    }
  };

  const startEdit = (record: OvertimeTracking) => {
    setEditingId(record.id);
    setEditData({
      ubicacion: record.ubicacion || '',
      actividad: record.actividad || '',
    });
  };

  const saveEdit = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, updates: editData });
      setEditingId(null);
    } catch (error: any) {
      alert(`Error al actualizar: ${error.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ ubicacion: '', actividad: '' });
  };

  const handleGPSUpload = async (file: File, overtimeId: string) => {
    try {
      setUploadingGPS(overtimeId);
      console.log('📁 Procesando archivo Excel GPS...');
      
      // Parsear Excel
      const records = await parseGPSExcel(file);
      console.log(`✅ ${records.length} registros GPS parseados`);
      
      // VALIDAR que el Excel coincida con el registro y obtener la placa esperada
      const validation = await validateGPSExcel(overtimeId, records);
      
      if (!validation.valid) {
        alert(validation.message);
        setUploadingGPS(null);
        return;
      }
      
      console.log('✅ Validación exitosa:', validation.message);
      
      // Obtener la placa esperada del registro de overtime
      const { data: overtimeRecord } = await supabase
        .from('overtime_tracking')
        .select('placa')
        .eq('id', overtimeId)
        .single();
      
      const expectedPlaca = overtimeRecord?.placa?.toUpperCase().trim();
      
      // FILTRAR registros solo de la placa correcta
      const recordsFiltrados = expectedPlaca 
        ? records.filter(r => r.movil.toUpperCase().trim() === expectedPlaca)
        : records;
      
      console.log(`📊 Usando ${recordsFiltrados.length} registros de la placa ${expectedPlaca} (de ${records.length} totales)`);
      
      if (recordsFiltrados.length === 0) {
        alert(`❌ No se encontraron registros de la placa ${expectedPlaca} en el Excel`);
        setUploadingGPS(null);
        return;
      }
      
      // ANALIZAR PRIMERO en memoria (más rápido) - solo con registros filtrados
      console.log('🔍 Analizando ruta en memoria...');
      const analysis = await analyzeAndUpdateRoute(overtimeId, recordsFiltrados);
      console.log('✅ Ruta analizada:', analysis);
      
      // LUEGO subir a Supabase (puede tardar, pero ya tenemos los resultados) - solo registros filtrados
      console.log('📤 Subiendo datos GPS a la base de datos (esto puede tardar)...');
      await uploadGPSData(overtimeId, recordsFiltrados);
      console.log('✅ Datos GPS subidos');
      
      alert(`✅ GPS procesado correctamente\n\n` +
            `Placa: ${expectedPlaca || recordsFiltrados[0]?.movil}\n` +
            `Inicio: ${analysis.entrada ? new Date(analysis.entrada).toLocaleString('es-CO') : 'N/A'}\n` +
            `Ubicación: ${analysis.ubicacion_entrada || 'N/A'}\n\n` +
            `Fin: ${analysis.salida ? new Date(analysis.salida).toLocaleString('es-CO') : 'N/A'}\n` +
            `Ubicación: ${analysis.ubicacion_salida || 'N/A'}\n\n` +
            `Total registros procesados: ${recordsFiltrados.length} de ${records.length} totales`);
      
      // Refrescar datos
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Error procesando GPS:', error);
      alert(`Error procesando GPS: ${error.message || 'Error desconocido'}\n\nVerifica la consola para más detalles.`);
    } finally {
      setUploadingGPS(null);
    }
  };

  const triggerGPSUpload = (overtimeId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        handleGPSUpload(file, overtimeId);
      }
    };
    input.click();
  };

  const handleMultiDayGPSUpload = async (file: File) => {
    try {
      setUploadingMultiDay(true);
      setMultiDayResult(null);
      console.log('📁 Procesando Excel GPS multi-día...');
      
      const result = await processMultiDayGPSExcel(file);
      setMultiDayResult(result);
      
      // Mostrar resumen
      const successMessage = `✅ Procesamiento Multi-Día Completado\n\n` +
        `📊 Total registros: ${result.totalRecords}\n` +
        `📅 Días procesados: ${result.processedDays}\n` +
        `✅ Exitosos: ${result.successfulDays}\n` +
        `❌ Fallidos: ${result.failedDays}\n\n` +
        `${result.failedDays > 0 ? '⚠️ Algunos días no se pudieron procesar. Revisa los detalles abajo.' : '🎉 Todos los días se procesaron correctamente.'}`;
      
      alert(successMessage);
      
      // Refrescar datos
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Error procesando Excel multi-día:', error);
      alert(`Error procesando Excel multi-día: ${error.message || 'Error desconocido'}\n\nVerifica la consola para más detalles.`);
    } finally {
      setUploadingMultiDay(false);
    }
  };

  const triggerMultiDayGPSUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        handleMultiDayGPSUpload(file);
      }
    };
    input.click();
  };

  const formatDecimal = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(4);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5); // HH:MM
  };

  const exportToExcel = () => {
    // TODO: Implementar exportación a Excel
    alert('Exportación a Excel - Implementar próximamente');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Seguimiento de Horas Extras</h1>
            <p className="mt-2 text-gray-600">
              Gestión y cálculo automático de horas extras, nocturnas y festivos
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={triggerMultiDayGPSUpload} 
              disabled={uploadingMultiDay}
              className="bg-green-600 hover:bg-green-700 text-white"
              title="Cargar Excel GPS con múltiples días para una o más placas. El sistema identificará automáticamente los registros correspondientes."
            >
              <Upload className={`h-4 w-4 mr-2 ${uploadingMultiDay ? 'animate-spin' : ''}`} />
              {uploadingMultiDay ? 'Procesando...' : 'Cargar Excel Multi-Día GPS'}
            </Button>
            <Button onClick={handleSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar desde Operation Hours'}
            </Button>
            <Button variant="secondary" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>

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

        {/* Tabla de Horas Extras */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              Registros de Horas Extras ({overtimeData?.total || 0})
            </h2>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Cargando registros...</p>
              </div>
            ) : overtimeRecords.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No hay registros de horas extras</p>
                <p className="text-sm text-gray-400">Haz clic en "Sincronizar" para importar desde Operation Hours</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Día</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Mes</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Placa</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Conductor</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">H. Entrada</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">H. Salida</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase bg-blue-50">Val. Entrada</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase bg-blue-50">Val. Salida</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-yellow-50">H.E. Diurna</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-yellow-50">Des/Alm</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-yellow-50">Compensado</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-green-50">Total H.E. Diurna</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-purple-50">H.E. Nocturna</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-red-50">Dom/Fest</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase bg-indigo-50">Horas Finales</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">GPS Entrada</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">GPS Salida</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Ubicación</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Actividad</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overtimeRecords.map((record) => {
                      const isEditing = editingId === record.id;
                      
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-gray-700">{record.dia_semana || '-'}</td>
                          <td className="px-2 py-2">
                            {record.tipo_dia === 'Festivo' ? (
                              <Badge variant="error" size="sm">Festivo</Badge>
                            ) : (
                              <Badge variant="info" size="sm">Hábil</Badge>
                            )}
                          </td>
                          <td className="px-2 py-2 text-gray-700">{record.mes || '-'}</td>
                          <td className="px-2 py-2 font-semibold text-gray-900">{record.placa}</td>
                          <td className="px-2 py-2 text-gray-700">{record.conductor}</td>
                          <td className="px-2 py-2 text-gray-700">
                            {format(parseISO(record.fecha), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-2 py-2 text-gray-700">{formatTime(record.hora_entrada)}</td>
                          <td className="px-2 py-2 text-gray-700">{formatTime(record.hora_salida)}</td>
                          <td className="px-2 py-2 text-center text-blue-700 bg-blue-50">{formatTime(record.validacion_entrada)}</td>
                          <td className="px-2 py-2 text-center text-blue-700 bg-blue-50">{formatTime(record.validacion_salida)}</td>
                          {/* Columnas calculadas usando GPS Entrada y GPS Salida (si están disponibles) */}
                          <td className="px-2 py-2 text-right text-yellow-700 bg-yellow-50 font-mono" title={record.hora_entrada_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)}` : 'Calculado con Hora Entrada manual'}>
                            {formatDecimal(record.he_diurna_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-yellow-700 bg-yellow-50 font-mono" title={record.hora_entrada_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)}` : 'Calculado con Hora Entrada manual'}>
                            {formatDecimal(record.desayuno_almuerzo_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-yellow-700 bg-yellow-50 font-mono" title={record.hora_entrada_gps && record.hora_salida_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)} y GPS Salida: ${formatTime(record.hora_salida_gps)}` : 'Calculado con horas manuales'}>
                            {formatDecimal(record.horario_compensado_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-green-700 bg-green-50 font-mono font-semibold" title={record.hora_entrada_gps && record.hora_salida_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)} y GPS Salida: ${formatTime(record.hora_salida_gps)}` : 'Calculado con horas manuales'}>
                            {formatDecimal(record.total_he_diurna_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-purple-700 bg-purple-50 font-mono font-semibold" title={record.hora_entrada_gps && record.hora_salida_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)} y GPS Salida: ${formatTime(record.hora_salida_gps)}` : 'Calculado con horas manuales'}>
                            {formatDecimal(record.he_nocturna_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-red-700 bg-red-50 font-mono font-semibold" title={record.hora_entrada_gps && record.hora_salida_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)} y GPS Salida: ${formatTime(record.hora_salida_gps)}` : 'Calculado con horas manuales'}>
                            {formatDecimal(record.dom_fest_decimal)}
                          </td>
                          <td className="px-2 py-2 text-right text-indigo-700 bg-indigo-50 font-mono font-bold text-sm" title={record.hora_entrada_gps && record.hora_salida_gps ? `Calculado con GPS Entrada: ${formatTime(record.hora_entrada_gps)} y GPS Salida: ${formatTime(record.hora_salida_gps)}` : 'Calculado con horas manuales'}>
                            {formatDecimal(record.horas_finales_decimal)}
                          </td>
                          <td className="px-2 py-2 text-gray-600 font-semibold" title={record.hora_entrada_gps ? 'Usado para calcular las horas extras' : 'No disponible - se usan horas manuales'}>
                            {formatTime(record.hora_entrada_gps) || '-'}
                          </td>
                          <td className="px-2 py-2 text-gray-600 font-semibold" title={record.hora_salida_gps ? 'Usado para calcular las horas extras' : 'No disponible - se usan horas manuales'}>
                            {formatTime(record.hora_salida_gps) || '-'}
                          </td>
                          <td className="px-2 py-2 max-w-xs">
                            {isEditing ? (
                              <Input
                                value={editData.ubicacion}
                                onChange={(e) => setEditData({ ...editData, ubicacion: e.target.value })}
                                placeholder="Ubicación"
                                className="text-xs"
                              />
                            ) : (
                              <span className="text-gray-700">{record.ubicacion || '-'}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 max-w-xs">
                            {isEditing ? (
                              <Input
                                value={editData.actividad}
                                onChange={(e) => setEditData({ ...editData, actividad: e.target.value })}
                                placeholder="Actividad"
                                className="text-xs"
                              />
                            ) : (
                              <span className="text-gray-700">{record.actividad || '-'}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              {isEditing ? (
                                <>
                                  <Button size="sm" onClick={() => saveEdit(record.id)} disabled={updateMutation.isPending}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={cancelEdit}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={() => triggerGPSUpload(record.id)}
                                    disabled={uploadingGPS === record.id}
                                    title="Cargar Excel GPS"
                                  >
                                    {uploadingGPS === record.id ? '...' : <Upload className="h-3 w-3" />}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={() => setViewingMap(record.id)}
                                    disabled={!record.gps_data_uploaded}
                                    title="Ver ruta GPS"
                                  >
                                    <MapPin className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => startEdit(record)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
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

        {/* Resultado de procesamiento multi-día */}
        {multiDayResult && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">
                📊 Resultado del Procesamiento Multi-Día
              </h3>
            </CardHeader>
            <CardBody>
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-600">Total Registros</p>
                  <p className="text-2xl font-bold text-blue-900">{multiDayResult.totalRecords}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Días Procesados</p>
                  <p className="text-2xl font-bold text-gray-900">{multiDayResult.processedDays}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-600">Exitosos</p>
                  <p className="text-2xl font-bold text-green-900">{multiDayResult.successfulDays}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-600">Fallidos</p>
                  <p className="text-2xl font-bold text-red-900">{multiDayResult.failedDays}</p>
                </div>
              </div>
              
              <div className="mt-4 max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Placa</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Registros</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {multiDayResult.results.map((result, index) => (
                      <tr key={index} className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 font-semibold text-gray-900">{result.placa}</td>
                        <td className="px-3 py-2 text-gray-700">{result.fecha}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{result.recordsProcessed}</td>
                        <td className="px-3 py-2 text-center">
                          {result.success ? (
                            <Badge variant="success" size="sm">✅ Exitoso</Badge>
                          ) : (
                            <Badge variant="error" size="sm">❌ Fallido</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-pre-line text-xs">
                          {result.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" onClick={() => setMultiDayResult(null)}>
                  Cerrar
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Leyenda de cálculos */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">📊 Leyenda de Cálculos</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="font-semibold text-yellow-900">H.E. Diurna</p>
                <p className="text-yellow-700">Horas extras entre 6:00 y 21:00</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="font-semibold text-yellow-900">Desayuno/Almuerzo</p>
                <p className="text-yellow-700">1-2 horas de descuento según horario</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="font-semibold text-yellow-900">Horario Compensado</p>
                <p className="text-yellow-700">Tiempo de llegadas tarde o salidas tempranas</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="font-semibold text-purple-900">H.E. Nocturna (x1.35)</p>
                <p className="text-purple-700">Horas entre 21:00 y 6:00</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="font-semibold text-red-900">Dom/Fest (x1.75)</p>
                <p className="text-red-700">Horas en domingos y festivos</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg">
                <p className="font-semibold text-indigo-900">Horas Finales</p>
                <p className="text-indigo-700">Suma total con multiplicadores aplicados</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Horarios Laborales:</strong> Los cálculos se basan en:
              </p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li><strong>Lunes-Jueves:</strong> 8:00 AM - 5:30 PM</li>
                <li><strong>Viernes:</strong> 8:00 AM - 4:00 PM</li>
                <li><strong>Sábado:</strong> 9:00 AM - 12:00 PM</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                <strong>H.E. Diurna:</strong> 6:00 AM - 8:00 AM y 5:30 PM - 9:00 PM (Lunes-Viernes) | 6:00 AM - 9:00 AM y 12:00 PM - 9:00 PM (Sábado)
              </p>
              <p className="text-xs text-blue-700 mt-1">
                <strong>H.E. Nocturna (x1.35):</strong> 9:00 PM - 6:00 AM
              </p>
              <p className="text-xs text-blue-700 mt-1">
                <strong>Alimentación:</strong> 1h si entra antes 7:00 AM | 2h si entra antes 7:00 AM y sale después 2:00 PM (Sábado/Domingo/Festivo)
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Modal de Mapa GPS */}
      {viewingMap && (
        <GPSRouteMap 
          overtimeTrackingId={viewingMap} 
          onClose={() => setViewingMap(null)} 
        />
      )}
    </MainLayout>
  );
};

