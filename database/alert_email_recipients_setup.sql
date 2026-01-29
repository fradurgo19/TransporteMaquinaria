-- ============================================
-- TABLA: alert_email_recipients
-- Destinatarios de alertas de vencimiento de documentos (Equipos)
-- ============================================

CREATE TABLE IF NOT EXISTS alert_email_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(50) NOT NULL CHECK (department IN ('transport', 'logistics')),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department, email)
);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_department ON alert_email_recipients(department);

-- Valores por defecto (transport / logistics)
INSERT INTO alert_email_recipients (department, email) VALUES
  ('transport', 'auxiliar.logisticamq@partequipos.com'),
  ('transport', 'logisticamq@partequipos.com'),
  ('transport', 'lgonzalez@partequipos.com'),
  ('logistics', 'bodega.medellin@partequipos.com')
ON CONFLICT (department, email) DO NOTHING;

ALTER TABLE alert_email_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage alert recipients" ON alert_email_recipients;
CREATE POLICY "Admins can manage alert recipients"
  ON alert_email_recipients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'admin_logistics')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'admin_logistics')
    )
  );

COMMENT ON TABLE alert_email_recipients IS 'Destinatarios de correos de alertas de vencimiento de documentos (Equipos)';
