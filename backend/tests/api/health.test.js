import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('API Health Check', () => {
  it('debe responder con status 200 en /health', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('message', 'Email service running');
  });
});
