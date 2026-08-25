const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSegments() {
  const contacts = await prisma.contact.findMany({
    include: { contactTags: { include: { tag: true } } }
  });
  console.log('--- CONTACTS ---');
  contacts.forEach(c => {
    console.log(`[ID ${Number(c.id)}] Org: ${Number(c.organizationId)}, Name: "${c.firstName} ${c.lastName||''}", Mobile: "${c.mobile}", OptIn: ${c.optIn}`);
    console.log(`   Tags (${c.contactTags.length}):`, c.contactTags.map(ct => ct.tag.name));
  });

  const segments = await prisma.segment.findMany();
  console.log('\n--- SEGMENTS ---');
  segments.forEach(s => {
    console.log(`[ID ${Number(s.id)}] Org: ${Number(s.organizationId)}, Name: "${s.name}", Filters:`, JSON.stringify(s.filters));
  });

  const tags = await prisma.tag.findMany();
  console.log('\n--- TAGS ---');
  tags.forEach(t => {
    console.log(`[ID ${Number(t.id)}] Org: ${Number(t.organizationId)}, Name: "${t.name}"`);
  });
}

debugSegments().catch(console.error).finally(() => prisma.$disconnect());
