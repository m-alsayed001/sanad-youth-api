import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  // clean (children first)
  await prisma.announcement.deleteMany();
  await prisma.application.deleteMany();
  await prisma.material.deleteMany();
  await prisma.session.deleteMany();
  await prisma.program.deleteMany();
  await prisma.user.deleteMany();

  const [adminPw, supPw, youthPw] = await Promise.all([
    bcrypt.hash('Admin@1234', 10),
    bcrypt.hash('Super@1234', 10),
    bcrypt.hash('Youth@1234', 10),
  ]);

  const admin = await prisma.user.create({
    data: { email: 'admin@sanad.org', password: adminPw, firstName: 'Sanad', lastName: 'Admin', role: 'ADMIN' },
  });
  const sup1 = await prisma.user.create({
    data: { email: 'supervisor1@sanad.org', password: supPw, firstName: 'Rami', lastName: 'Haddad', role: 'SUPERVISOR' },
  });
  const sup2 = await prisma.user.create({
    data: { email: 'supervisor2@sanad.org', password: supPw, firstName: 'Lina', lastName: 'Khoury', role: 'SUPERVISOR' },
  });

  await prisma.user.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      email: `youth${i + 1}@sanad.org`,
      password: youthPw,
      firstName: 'Youth',
      lastName: `${i + 1}`,
      role: 'YOUTH' as const,
    })),
  });

  const programs = [
    ['Web Development Basics', 'Learn HTML, CSS and JavaScript from zero to your first website.', 25, sup1.id],
    ['Backend with NestJS', 'Build real REST APIs with NestJS, Prisma and PostgreSQL.', 20, sup1.id],
    ['UI/UX Design Workshop', 'Design thinking, wireframes and prototyping in Figma.', 15, sup1.id],
    ['Data Analysis with Python', 'Pandas, charts and storytelling with data.', 20, sup1.id],
    ['Mobile Apps with Flutter', 'Create cross-platform mobile apps with Flutter.', 18, sup1.id],
    ['Digital Marketing 101', 'Social media, content strategy and analytics.', 30, sup1.id],
    ['Public Speaking Bootcamp', 'Build confidence and deliver powerful talks.', 12, sup2.id],
    ['Entrepreneurship Lab', 'From idea to a validated business model.', 15, sup2.id],
    ['English for Work', 'Professional English for interviews and emails.', 25, sup2.id],
    ['Graphic Design Essentials', 'Photoshop and Illustrator for beginners.', 20, sup2.id],
    ['Career Readiness', 'CV writing, LinkedIn and interview practice.', 40, sup2.id],
    ['Last Seat Challenge', 'Demo program with exactly ONE seat to test concurrency.', 1, sup2.id],
  ] as const;

  const day = 24 * 60 * 60 * 1000;
  for (const [i, [title, description, capacity, supervisorId]] of programs.entries()) {
    await prisma.program.create({
      data: {
        title,
        description,
        capacity,
        availableSeats: capacity,
        supervisorId,
        sessions: {
          create: [
            {
              title: 'Session 1 - Kickoff',
              startsAt: new Date(Date.now() + (i + 3) * day),
              endsAt: new Date(Date.now() + (i + 3) * day + 2 * 3600_000),
              location: 'Sanad Center - Hall A',
            },
            {
              title: 'Session 2 - Online',
              startsAt: new Date(Date.now() + (i + 10) * day),
              endsAt: new Date(Date.now() + (i + 10) * day + 2 * 3600_000),
              meetingUrl: 'https://meet.google.com/abc-defg-hij',
            },
          ],
        },
      },
    });
  }

  await prisma.announcement.create({
    data: {
      title: 'Welcome to Sanad Youth!',
      content: 'Registration for the autumn programs is now open.',
      scope: 'GENERAL',
      authorId: admin.id,
    },
  });

  console.log('Seed done: 1 admin, 2 supervisors, 30 youth, 12 programs');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
