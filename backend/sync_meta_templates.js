const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
let apiKey = '';
let baseUrl = 'https://live.themessenger.app/api';
envContent.split('\n').forEach(line => {
  const clean = line.trim();
  if (clean.startsWith('MESSENGER_API_KEY=')) {
    apiKey = clean.substring('MESSENGER_API_KEY='.length).replace(/^["']|["']$/g, '');
  }
  if (clean.startsWith('MESSENGER_API_BASE_URL=')) {
    baseUrl = clean.substring('MESSENGER_API_BASE_URL='.length).replace(/^["']|["']$/g, '');
  }
});

async function sync() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found');
    return;
  }
  const orgId = org.id;

  const url = baseUrl.replace(/\/+$/, '') + '/get_templates?limit=100';
  console.log('Fetching live templates from:', url);
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
  });
  const data = await res.json();
  const remoteTemplates = data.data || [];
  console.log(`Found ${remoteTemplates.length} templates in Messenger API.`);

  let syncedCount = 0;
  for (const t of remoteTemplates) {
    let headerText = null;
    let bodyText = '';
    let footerText = null;

    if (Array.isArray(t.components)) {
      for (const comp of t.components) {
        if (comp.type === 'HEADER' && comp.text) headerText = comp.text;
        if (comp.type === 'BODY' && comp.text) bodyText = comp.text;
        if (comp.type === 'FOOTER' && comp.text) footerText = comp.text;
      }
    }

    if (!bodyText) {
      bodyText = t.body || t.name;
    }

    const existing = await prisma.template.findFirst({
      where: {
        organizationId: orgId,
        name: t.name,
      },
    });

    const status = (t.status || 'APPROVED').toLowerCase();
    const category = (t.category || 'MARKETING').toUpperCase();
    const language = t.language || 'en';

    if (existing) {
      await prisma.template.update({
        where: { id: existing.id },
        data: {
          category,
          language,
          status,
          header: headerText,
          body: bodyText,
          footer: footerText,
          metaTemplateId: t.id ? String(t.id) : existing.metaTemplateId,
        },
      });
    } else {
      await prisma.template.create({
        data: {
          organizationId: orgId,
          name: t.name,
          category,
          language,
          status,
          header: headerText,
          body: bodyText,
          footer: footerText,
          metaTemplateId: t.id ? String(t.id) : null,
        },
      });
    }
    syncedCount++;
  }

  console.log(`Successfully synced ${syncedCount} templates to database!`);
  const allDbTemplates = await prisma.template.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, language: true, status: true },
  });
  console.log('All DB templates:', allDbTemplates.map(t => `${t.name} (${t.language}) [${t.status}]`));
}

sync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
