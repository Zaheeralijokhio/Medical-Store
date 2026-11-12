import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(decodedToken: {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}) {
  const { uid, email, name, picture } = decodedToken;
  if (!email) {
    throw new Error('Email is required inside the auth token');
  }

  try {
    const [user] = await db
      .insert(users)
      .values({
        id: uid,
        email,
        displayName: name || null,
        photoUrl: picture || null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          displayName: name || null,
          photoUrl: picture || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  } catch (error: any) {
    console.error('[Database Error]:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    throw new Error('Failed to synchronize user account');
  }
}
