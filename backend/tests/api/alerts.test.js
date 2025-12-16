import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('API Alerts', () => {
  it('debe responder con error 400 si falta operation_id en send-operation-notification', async () => {
    const response = await request(app)
      .post('/send-operation-notification')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('operation_id es requerido');
  });

  it('debe responder con error 400 si falta request_id en send-transport-request-notification', async () => {
    const response = await request(app)
      .post('/send-transport-request-notification')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('request_id es requerido');
  });
});
