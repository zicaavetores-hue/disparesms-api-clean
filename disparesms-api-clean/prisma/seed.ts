// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ── Planos ──────────────────────────────────
  const starter = await prisma.plan.upsert({
    where: { slug: 'starter' },
    update: {},
    create: {
      name: 'Starter',
      slug: 'starter',
      price: 150,
      smsLimit: 1000,
      pricePerSms: 0.15,
      features: { api: false, scheduling: true, reports: true, multiUser: false },
    },
  });

  const pro = await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {},
    create: {
      name: 'Pro',
      slug: 'pro',
      price: 600,
      smsLimit: 5000,
      pricePerSms: 0.12,
      features: { api: true, scheduling: true, reports: true, multiUser: true },
    },
  });

  const enterprise = await prisma.plan.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      slug: 'enterprise',
      price: 0,       // negociado
      smsLimit: 0,    // ilimitado
      pricePerSms: 0.08,
      features: { api: true, scheduling: true, reports: true, multiUser: true, dedicatedSupport: true },
    },
  });

  console.log('✅ Planos criados:', starter.name, pro.name, enterprise.name);

  // ── Tenant admin (você) ─────────────────────
  const adminTenant = await prisma.tenant.upsert({
    where: { slug: 'disparesms-admin' },
    update: {},
    create: {
      name: 'DisparesSMS Admin',
      slug: 'disparesms-admin',
      email: 'admin@disparesms.com.br',
      planId: enterprise.id,
      creditsBalance: 999999,
      status: 'ACTIVE',
    },
  });

  const passwordHash = await bcrypt.hash('Admin@2025!', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: adminTenant.id, email: 'admin@disparesms.com.br' } },
    update: {},
    create: {
      tenantId: adminTenant.id,
      name: 'Admin DisparesSMS',
      email: 'admin@disparesms.com.br',
      passwordHash,
      role: 'OWNER',
    },
  });

  console.log('✅ Admin criado:', adminUser.email);

  // ── Tenant demo (Fruitfy) ───────────────────
  const fruitfyTenant = await prisma.tenant.upsert({
    where: { slug: 'fruitfy' },
    update: {},
    create: {
      name: 'Fruitfy',
      slug: 'fruitfy',
      email: 'contato@fruitfy.com.br',
      planId: pro.id,
      creditsBalance: 5000,
      status: 'ACTIVE',
    },
  });

  const fruitfyAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: fruitfyTenant.id, email: 'dev@fruitfy.com.br' } },
    update: {},
    create: {
      tenantId: fruitfyTenant.id,
      name: 'Dev Fruitfy',
      email: 'dev@fruitfy.com.br',
      passwordHash: await bcrypt.hash('Fruitfy@2025!', 12),
      role: 'OWNER',
    },
  });

  console.log('✅ Tenant demo criado:', fruitfyTenant.name, '|', fruitfyAdmin.email);
  console.log('\n🚀 Seed concluído com sucesso!');
  console.log('\n📋 Credenciais de acesso:');
  console.log('   Admin: admin@disparesms.com.br / Admin@2025!');
  console.log('   Fruitfy: dev@fruitfy.com.br / Fruitfy@2025!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
