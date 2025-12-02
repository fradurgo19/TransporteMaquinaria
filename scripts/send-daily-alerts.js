// Script para enviar alertas de vencimiento automáticamente
// Ejecutar diariamente: node scripts/send-daily-alerts.js

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'TU_SUPABASE_URL';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'TU_SUPABASE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'fradurgo19@gmail.com',
    pass: 'asovvyyfobpuzzvd',
  },
});

async function sendDailyAlerts() {
  const { data, error } = await supabase.rpc('get_pending_notifications');
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('✅ No hay alertas pendientes');
    return;
  }

  console.log(`📧 Enviando ${data.length} alertas...`);

  for (const doc of data) {
    const recipient = doc.department === 'transport' 
      ? 'logisticamq1@partequipos.com' 
      : 'bodega.medellin@partequipos.com';

    await transporter.sendMail({
      from: 'fradurgo19@gmail.com',
      to: recipient,
      subject: `⚠️ Documento vence en ${doc.days_until_expiration} días - ${doc.license_plate}`,
      html: `<h1>Alerta de vencimiento</h1><p>Placa: ${doc.license_plate}</p>`,
    });

    console.log(`✅ Email enviado: ${doc.license_plate}`);
  }
}

sendDailyAlerts();

