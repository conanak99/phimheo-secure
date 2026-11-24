import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { comments, users, videos } from '../src/db/schema';
import { hashPassword } from '../src/lib/password';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var for seeding: ${name}`);
  }
  return value;
}

const seedVideos = [
  {
    title: 'Heo Con Tắm Nắng Buổi Sáng',
    description:
      'Một chú heo hồng bé xíu cuộn mình trong chiếc chăn xanh và lim dim dưới nắng sớm.',
    videoFilename: 'heo-con-tam-nang.mp4',
    thumbnailUrl: '/thumbnails/heo-con-tam-nang.jpg',
    isPremiumOnly: false,
    posterFrom: '#bde9ff',
    posterTo: '#ffb3ce',
    emoji: '🐷',
    duration: '00:05',
    views: 481233,
  },
  {
    title: 'Đôi Bạn Heo Dưới Cơn Mưa',
    description:
      'Hai chú heo con che chung một chiếc ô hình trái tim trên con đường làng.',
    videoFilename: 'doi-ban-heo-duoi-mua.mp4',
    thumbnailUrl: '/thumbnails/doi-ban-heo-duoi-mua.jpg',
    isPremiumOnly: false,
    posterFrom: '#a7d8ff',
    posterTo: '#ff9fc3',
    emoji: '🐽',
    duration: '00:05',
    views: 992104,
  },
  {
    title: 'Hiệp Sĩ Heo Và Vương Quốc Mây',
    description: 'Hiệp sĩ heo mặc áo giáp xanh bảo vệ lâu đài trên mây.',
    videoFilename: 'hiep-si-heo.mp4',
    thumbnailUrl: '/thumbnails/hiep-si-heo.jpg',
    isPremiumOnly: false,
    posterFrom: '#5bc0ff',
    posterTo: '#6a7cff',
    emoji: '🐷',
    duration: '00:05',
    views: 210887,
  },
  {
    title: 'Bếp Trưởng Heo Làm Bánh',
    description: 'Bếp trưởng heo tung bột lên cao rồi phủ trắng cả căn bếp.',
    videoFilename: 'bep-truong-heo.mp4',
    thumbnailUrl: '/thumbnails/bep-truong-heo.jpg',
    isPremiumOnly: false,
    posterFrom: '#d9f2ff',
    posterTo: '#ffc6dc',
    emoji: '🐽',
    duration: '00:05',
    views: 1403902,
  },
  {
    title: 'Heo Phi Hành Gia Chạm Tới Mặt Trăng',
    description:
      'Nhà du hành heo đáp xuống mặt trăng và ngắm Trái Đất xanh.',
    videoFilename: 'heo-phi-hanh-gia.mp4',
    thumbnailUrl: '/thumbnails/heo-phi-hanh-gia.jpg',
    isPremiumOnly: true,
    posterFrom: '#142b6f',
    posterTo: '#00aff0',
    emoji: '🐷',
    duration: '00:05',
    views: 88412,
  },
  {
    title: 'Heo Con Lướt Sóng Hoàng Hôn',
    description: 'Chú heo đeo kính xanh lướt trên con sóng lấp lánh.',
    videoFilename: 'heo-luot-song.mp4',
    thumbnailUrl: '/thumbnails/heo-luot-song.jpg',
    isPremiumOnly: true,
    posterFrom: '#00aff0',
    posterTo: '#ff8db8',
    emoji: '🐽',
    duration: '00:05',
    views: 64330,
  },
  {
    title: 'Gia Đình Heo Đi Dã Ngoại',
    description:
      'Cả nhà heo chia nhau dâu tây và ngắm bướm trong công viên.',
    videoFilename: 'gia-dinh-heo-da-ngoai.mp4',
    thumbnailUrl: '/thumbnails/gia-dinh-heo-da-ngoai.jpg',
    isPremiumOnly: true,
    posterFrom: '#86e3ce',
    posterTo: '#ffb6d0',
    emoji: '🐷',
    duration: '00:05',
    views: 41209,
  },
  {
    title: 'Heo Múa Lân Đón Tết',
    description:
      'Chú heo mặc áo dài xanh múa lân dưới những chiếc đèn lồng.',
    videoFilename: 'heo-mua-lan.mp4',
    thumbnailUrl: '/thumbnails/heo-mua-lan.jpg',
    isPremiumOnly: true,
    posterFrom: '#ff5876',
    posterTo: '#00aff0',
    emoji: '🐽',
    duration: '00:05',
    views: 57884,
  },
  {
    title: 'Heo Spa Bong Bóng',
    description:
      'Chú heo thư giãn trong bồn tắm bong bóng và bất ngờ khi bong bóng vỡ trên mũi.',
    videoFilename: 'heo-spa-bong-bong.mp4',
    thumbnailUrl: '/thumbnails/heo-spa-bong-bong.jpg',
    isPremiumOnly: false,
    posterFrom: '#e8f8ff',
    posterTo: '#8ed8f8',
    emoji: '🐷',
    duration: '00:05',
    views: 73421,
  },
  {
    title: 'Heo Bay Khinh Khí Cầu',
    description:
      'Hai chú heo con bay qua thung lũng hoa trên chiếc khinh khí cầu xanh hồng.',
    videoFilename: 'heo-khinh-khi-cau.mp4',
    thumbnailUrl: '/thumbnails/heo-khinh-khi-cau.jpg',
    isPremiumOnly: true,
    posterFrom: '#77c9f5',
    posterTo: '#ff9fc6',
    emoji: '🐽',
    duration: '00:05',
    views: 96808,
  },
];

async function seed() {
  console.log('Seeding OnlyHeo Secure database...');

  const demoUsers = [
    {
      username: 'me_heo_hong',
      email: 'linh@onlyheo.vn',
      password: requireEnv('SEED_USER_LINH_PASSWORD'),
      bio: 'Mê heo hồng, bánh ngọt và những chiếc mũ tí hon.',
      isPremium: false,
      isAdmin: false,
    },
    {
      username: 'bac_si_heo',
      email: 'minh@onlyheo.vn',
      password: requireEnv('SEED_USER_MINH_PASSWORD'),
      bio: 'Bác sĩ thú y, chuyên chăm sóc những bạn heo đáng yêu.',
      isPremium: true,
      isAdmin: false,
    },
    {
      username: 'heo_phuot_thu',
      email: 'an@onlyheo.vn',
      password: requireEnv('SEED_USER_AN_PASSWORD'),
      bio: 'Chụp ảnh những chú heo trong các chuyến đi khắp Việt Nam.',
      isPremium: true,
      isAdmin: false,
    },
    {
      username: 'admin',
      email: requireEnv('SEED_ADMIN_EMAIL').toLowerCase(),
      password: requireEnv('SEED_ADMIN_PASSWORD'),
      bio: 'Tài khoản quản trị OnlyHeo.',
      isPremium: true,
      isAdmin: true,
    },
  ];

  // Clear existing data cleanly for a deterministic reset
  await db.delete(comments);
  await db.delete(videos);
  await db.delete(users);

  const insertedVideos = await db
    .insert(videos)
    .values(seedVideos)
    .returning();

  const videoByTitle = new Map(insertedVideos.map((v) => [v.title, v]));

  const userByEmail = new Map<string, string>();
  for (const u of demoUsers) {
    const passwordHash = await hashPassword(u.password);
    const [inserted] = await db
      .insert(users)
      .values({
        username: u.username,
        email: u.email.toLowerCase(),
        passwordHash,
        bio: u.bio,
        isPremium: u.isPremium,
        isAdmin: u.isAdmin,
      })
      .returning();
    if (inserted) {
      userByEmail.set(inserted.email, inserted.id);
    }
  }

  const seedComments = [
    {
      videoTitle: 'Heo Con Tắm Nắng Buổi Sáng',
      userEmail: 'linh@onlyheo.vn',
      content: 'Hai cái tai rung rung dễ thương quá! 🐷',
    },
    {
      videoTitle: 'Heo Con Tắm Nắng Buổi Sáng',
      userEmail: 'minh@onlyheo.vn',
      content: 'Nắng sớm rất tốt, nhưng nhớ thoa kem chống nắng cho bé nhé.',
    },
    {
      videoTitle: 'Đôi Bạn Heo Dưới Cơn Mưa',
      userEmail: 'an@onlyheo.vn',
      content: 'Chiếc ô trái tim là chi tiết đáng yêu nhất hôm nay.',
    },
    {
      videoTitle: 'Hiệp Sĩ Heo Và Vương Quốc Mây',
      userEmail: 'minh@onlyheo.vn',
      content: 'Hiệp sĩ bé xíu nhưng khí thế thì cực kỳ hoành tráng!',
    },
    {
      videoTitle: 'Heo Phi Hành Gia Chạm Tới Mặt Trăng',
      userEmail: 'an@onlyheo.vn',
      content: 'Cảnh nhìn Trái Đất từ mặt trăng xứng đáng gói VIP.',
    },
  ];

  for (const c of seedComments) {
    const video = videoByTitle.get(c.videoTitle);
    const userId = userByEmail.get(c.userEmail);
    if (video && userId) {
      await db.insert(comments).values({
        videoId: video.id,
        userId,
        content: c.content,
      });
    }
  }

  const checkAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true));

  console.log(
    `Seeded ${insertedVideos.length} videos, ${userByEmail.size} users (${checkAdmin.length} admin), ${seedComments.length} comments.`,
  );
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
