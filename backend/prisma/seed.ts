import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'user.manage', 'user.view',
  'org.manage',
  'waba.manage', 'waba.view',
  'contacts.manage', 'contacts.view',
  'templates.manage', 'templates.view',
  'messages.send', 'messages.view',
  'conversations.manage', 'conversations.view',
  'campaigns.manage', 'campaigns.view',
  'bots.manage',
  'wallet.view', 'wallet.manage',
  'reports.view',
  'invoices.view',
  'audit.view',
];

const ROLE_PERMS: Record<string, string[]> = {
  super_admin: [...PERMISSIONS],
  org_admin: [...PERMISSIONS],
  supervisor: [
    'user.view',
    'waba.view',
    'contacts.manage', 'contacts.view',
    'templates.manage', 'templates.view',
    'messages.send', 'messages.view',
    'conversations.manage', 'conversations.view',
    'campaigns.manage', 'campaigns.view',
    'bots.manage',
    'wallet.view',
    'reports.view',
  ],
  agent: [
    'waba.view',
    'contacts.view',
    'messages.send', 'messages.view',
    'conversations.manage', 'conversations.view',
  ],
  reseller: ['wallet.manage', 'wallet.view', 'reports.view', 'contacts.view'],
};

async function seedPermissions() {
  const byName = new Map<string, number>();
  for (const name of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { code: name },
      create: { code: name, description: name },
      update: {},
    });
    byName.set(name, Number(p.id));
  }
  return byName;
}

async function seedRoles(orgId: bigint, perms: Map<string, number>) {
  const roles = new Map<string, bigint>();
  for (const [code, permNames] of Object.entries(ROLE_PERMS)) {
    let role = await prisma.role.findFirst({
      where: { organizationId: orgId, name: code },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: code,
          description: code.replace(/_/g, ' '),
        },
      });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permNames.map((name) => ({
        roleId: role.id,
        permissionId: BigInt(perms.get(name)!),
      })),
    });
    roles.set(code, role.id);
  }
  return roles;
}

async function main() {
  const perms = await seedPermissions();

  // Super admin user (global, attached to an internal org)
  let adminOrg = await prisma.organization.findFirst({
    where: { slug: 'whatsappwiz' },
  });
  if (!adminOrg) {
    adminOrg = await prisma.organization.create({
      data: { name: 'Whatsapp Wiz', slug: 'whatsappwiz' },
    });
  }
  const adminRoles = await seedRoles(adminOrg.id, perms);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@whatsappwiz.io';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('Admin@123', 10),
        firstName: 'System',
        lastName: 'Admin',
        organizationId: adminOrg.id,
        roleId: adminRoles.get('super_admin')!,
        status: 'active',
      },
    });
    console.log(`Created super admin: ${adminEmail} / Admin@123`);
  }

  // Demo organization
  let demoOrg = await prisma.organization.findFirst({
    where: { slug: 'demo' },
  });
  if (!demoOrg) {
    demoOrg = await prisma.organization.create({
      data: { name: 'Demo Company', slug: 'demo' },
    });
  }
  const demoRoles = await seedRoles(demoOrg.id, perms);

  const users: { email: string; password: string; firstName: string; lastName: string; role: string }[] = [
    { email: 'admin@demo.com', password: 'Admin@123', firstName: 'Demo', lastName: 'Admin', role: 'org_admin' },
    { email: 'supervisor@demo.com', password: 'Supervisor@123', firstName: 'Demo', lastName: 'Supervisor', role: 'supervisor' },
    { email: 'agent@demo.com', password: 'Agent@123', firstName: 'Demo', lastName: 'Agent', role: 'agent' },
    { email: 'reseller@demo.com', password: 'Reseller@123', firstName: 'Demo', lastName: 'Reseller', role: 'reseller' },
  ];

  const userIds: number[] = [];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        firstName: u.firstName,
        lastName: u.lastName,
        organizationId: demoOrg.id,
        roleId: demoRoles.get(u.role)!,
        status: 'active',
      },
      update: {},
    });
    userIds.push(Number(user.id));
    console.log(`Ensured user ${u.email} (${u.role})`);
  }

  // Demo wallet with a healthy balance
  const wallet = await prisma.wallet.upsert({
    where: { organizationId: demoOrg.id },
    create: { organizationId: demoOrg.id, balance: 5000, currency: 'INR' },
    update: {},
  });
  console.log(`Demo wallet balance: ${wallet.balance} ${wallet.currency}`);

  // Real WABA and numbers are configured dynamically via Meta API / Dashboard
  // No fake demo numbers or contacts seeded.

  // Approved templates for campaigns
  const templateCount = await prisma.template.count({
    where: { organizationId: demoOrg.id },
  });
  if (templateCount === 0) {
    await prisma.template.createMany({
      data: [
        { organizationId: demoOrg.id, name: 'welcome_message', language: 'en', category: 'MARKETING', body: 'Hi {{1}}, welcome to Demo Company! Enjoy your day.', status: 'approved' },
        { organizationId: demoOrg.id, name: 'order_confirmation', language: 'en', category: 'UTILITY', body: 'Hi {{1}}, your order has been confirmed. Order ID: {{2}}.', status: 'approved' },
      ],
    });
    console.log('Created 2 approved demo templates');
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
