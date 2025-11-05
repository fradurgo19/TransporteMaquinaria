import React from 'react';
import { MainLayout } from '../templates/MainLayout';
import { Card, CardHeader, CardBody } from '../atoms/Card';
import { DataTable } from '../organisms/DataTable';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Plus } from 'lucide-react';
import { useProtectedRoute } from '../hooks/useProtectedRoute';

export const TransportRequestsPage: React.FC = () => {
  useProtectedRoute(['admin', 'user', 'commercial']);

  const mockRequests = [
    {
      id: '1',
      serialNumber: 'SN-12345',
      brand: 'Caterpillar',
      model: '320D',
      origin: 'Warehouse A',
      destination: 'Site B',
      status: 'pending',
    },
  ];

  const columns = [
    { key: 'serialNumber', label: 'Serial Number', sortable: true },
    { key: 'brand', label: 'Brand', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    { key: 'origin', label: 'Origin', sortable: true },
    { key: 'destination', label: 'Destination', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (item: any) => (
        <Badge variant={item.status === 'pending' ? 'warning' : 'success'}>
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transport Requests</h1>
            <p className="mt-2 text-gray-600">
              Manage equipment transport requests
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">All Requests</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              data={mockRequests}
              columns={columns}
              emptyMessage="No transport requests found"
            />
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
};
